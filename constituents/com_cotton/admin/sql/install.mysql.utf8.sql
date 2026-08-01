DROP TABLE IF EXISTS `#__cotton_folder`;
DROP TABLE IF EXISTS `#__cotton_file`;

CREATE TABLE IF NOT EXISTS `#__cotton_folder`(
	`id` INT(11) NOT NULL AUTO_INCREMENT,
	`owner_id` INT(11) NOT NULL,
	`name` VARCHAR(255) NOT NULL,
	`description` VARCHAR(1023) NOT NULL DEFAULT '',
	`date_created` DATETIME NOT NULL,
	`date_updated` DATETIME NOT NULL,
	`featured` TINYINT NOT NULL DEFAULT 0,
	`parent_id` INT(11) NOT NULL,
	`allowed_users` LONGTEXT,
	`open_link` TINYINT NOT NULL DEFAULT 0,
	`trash` TINYINT NOT NULL DEFAULT 0,
	`params` LONGTEXT,
	PRIMARY KEY(`id`)
	)
	ENGINE=InnoDB 
	DEFAULT CHARSET=utf8mb4 
	DEFAULT COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `#__cotton_file`(
	`id` INT(11) NOT NULL AUTO_INCREMENT,
	`owner_id` INT(11) NOT NULL,
	`name` VARCHAR(255) NOT NULL DEFAULT '',
	`description` VARCHAR(1023) NOT NULL DEFAULT '',
	`date_created` DATETIME NOT NULL,
	`date_updated` DATETIME NOT NULL,
	`featured` TINYINT NOT NULL DEFAULT 0,
	`file_data` LONGBLOB,
	`size` INT(20) NOT NULL DEFAULT 0,
	`folder_id` INT(11) NOT NULL,
	`allowed_users` LONGTEXT,
	`open_link` TINYINT NOT NULL DEFAULT 0,
	`trash` TINYINT NOT NULL DEFAULT 0,
	`params` LONGTEXT,
	PRIMARY KEY(`id`)
	)
	ENGINE=InnoDB 
	DEFAULT CHARSET=utf8mb4 
	DEFAULT COLLATE=utf8mb4_unicode_ci;