CREATE TABLE `auth_attempts` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `experiment_days` (
	`id` text PRIMARY KEY NOT NULL,
	`experiment_id` text NOT NULL,
	`day_index` integer NOT NULL,
	`date` text NOT NULL,
	`minutes` integer NOT NULL,
	`note` text NOT NULL,
	`outlier_confirmed` integer NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`experiment_id`) REFERENCES `experiments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `day_date_unique` ON `experiment_days` (`experiment_id`,`date`);--> statement-breakpoint
CREATE UNIQUE INDEX `day_index_unique` ON `experiment_days` (`experiment_id`,`day_index`);--> statement-breakpoint
CREATE TABLE `experiments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`question` text NOT NULL,
	`metric` text NOT NULL,
	`unit` text NOT NULL,
	`rules` text NOT NULL,
	`initial_rule` text NOT NULL,
	`changed_rule` text,
	`changed_at` text,
	`reason` text,
	`created` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `experiments_user_id_unique` ON `experiments` (`user_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`version` integer NOT NULL,
	`expires` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`auth_version` integer DEFAULT 1 NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
ALTER TABLE `plans` ADD `owner_id` text REFERENCES users(id);