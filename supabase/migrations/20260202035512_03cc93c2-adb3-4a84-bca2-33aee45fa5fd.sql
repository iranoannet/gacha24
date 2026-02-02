-- Allow NULL gacha_id for tenant-wide animation videos
ALTER TABLE gacha_animation_videos ALTER COLUMN gacha_id DROP NOT NULL;

-- Update foreign key to allow null values (if needed)
COMMENT ON COLUMN gacha_animation_videos.gacha_id IS 'NULL means tenant-wide animation, otherwise gacha-specific';