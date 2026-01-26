-- 原子的なガチャ処理を行うデータベース関数
CREATE OR REPLACE FUNCTION public.play_gacha_atomic(
  p_user_id UUID,
  p_gacha_id UUID,
  p_play_count INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gacha RECORD;
  v_profile RECORD;
  v_total_cost INTEGER;
  v_transaction_id UUID;
  v_slot_ids UUID[];
  v_card_ids UUID[];
  v_result JSONB;
BEGIN
  -- ガチャ情報を取得（行ロック付き）
  SELECT * INTO v_gacha
  FROM gacha_masters
  WHERE id = p_gacha_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ガチャが見つかりません');
  END IF;

  IF v_gacha.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'このガチャは現在利用できません');
  END IF;

  IF v_gacha.remaining_slots < p_play_count THEN
    RETURN jsonb_build_object('success', false, 'error', format('残り口数が足りません（残り: %s口）', v_gacha.remaining_slots));
  END IF;

  -- ユーザープロフィールを取得（行ロック付き）
  SELECT * INTO v_profile
  FROM profiles
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'プロフィールが見つかりません');
  END IF;

  v_total_cost := v_gacha.price_per_play * p_play_count;

  IF v_profile.points_balance < v_total_cost THEN
    RETURN jsonb_build_object('success', false, 'error', format('ポイントが足りません（必要: %spt, 残高: %spt）', v_total_cost, v_profile.points_balance));
  END IF;

  -- 未抽選スロットをランダムに取得してロック
  SELECT array_agg(id), array_agg(card_id)
  INTO v_slot_ids, v_card_ids
  FROM (
    SELECT id, card_id
    FROM gacha_slots
    WHERE gacha_id = p_gacha_id
      AND is_drawn = false
    ORDER BY random()
    LIMIT p_play_count
    FOR UPDATE SKIP LOCKED
  ) AS slots;

  IF v_slot_ids IS NULL OR array_length(v_slot_ids, 1) < p_play_count THEN
    RETURN jsonb_build_object('success', false, 'error', '利用可能なスロットがありません（他のユーザーが同時に引いた可能性があります）');
  END IF;

  -- トランザクションを作成
  INSERT INTO user_transactions (user_id, gacha_id, play_count, total_spent_points, status, result_items)
  VALUES (p_user_id, p_gacha_id, p_play_count, v_total_cost, 'completed', to_jsonb(v_slot_ids))
  RETURNING id INTO v_transaction_id;

  -- スロットを更新
  UPDATE gacha_slots
  SET is_drawn = true,
      user_id = p_user_id,
      drawn_at = now(),
      transaction_id = v_transaction_id
  WHERE id = ANY(v_slot_ids);

  -- ポイントを減算
  UPDATE profiles
  SET points_balance = points_balance - v_total_cost
  WHERE user_id = p_user_id;

  -- 残り口数を更新
  UPDATE gacha_masters
  SET remaining_slots = remaining_slots - p_play_count
  WHERE id = p_gacha_id;

  -- 結果を返す（カード情報も含める）
  SELECT jsonb_build_object(
    'success', true,
    'transactionId', v_transaction_id,
    'totalCost', v_total_cost,
    'newBalance', v_profile.points_balance - v_total_cost,
    'drawnCards', (
      SELECT jsonb_agg(jsonb_build_object(
        'slotId', gs.id,
        'cardId', c.id,
        'name', c.name,
        'imageUrl', c.image_url,
        'prizeTier', c.prize_tier,
        'conversionPoints', c.conversion_points
      ))
      FROM gacha_slots gs
      JOIN cards c ON c.id = gs.card_id
      WHERE gs.id = ANY(v_slot_ids)
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;