-- ガチャに注意書きフィールドを追加
ALTER TABLE public.gacha_masters 
ADD COLUMN notice_text text DEFAULT '【最低保証5pt】
【注意事項】
当たりカード含め、初期傷など一部損傷箇所がある場合がございます。商品の返金・交換はできません。
上記、ご了承の上でご購入をお願い致します。';