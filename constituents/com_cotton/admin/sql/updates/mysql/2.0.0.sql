-- Remove unused fields from cotton_file table
ALTER TABLE `#__cotton_file` DROP COLUMN IF EXISTS `downloads`;
ALTER TABLE `#__cotton_file` DROP COLUMN IF EXISTS `mime_type`;
