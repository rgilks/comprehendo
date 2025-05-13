CREATE TABLE `question_feedback` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`quiz_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`is_good` integer NOT NULL,
	`user_answer` text,
	`is_correct` integer,
	`submitted_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`quiz_id`) REFERENCES `quiz`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `quiz` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`language` text NOT NULL,
	`level` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	`question_language` text,
	`user_id` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`ip_address` text PRIMARY KEY NOT NULL,
	`request_count` integer DEFAULT 1 NOT NULL,
	`window_start_time` integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_language_progress` (
	`user_id` integer NOT NULL,
	`language_code` text NOT NULL,
	`cefr_level` text DEFAULT 'A1' NOT NULL,
	`correct_streak` integer DEFAULT 0 NOT NULL,
	`last_practiced` integer DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY(`user_id`, `language_code`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider_id` text NOT NULL,
	`provider` text NOT NULL,
	`name` text,
	`email` text,
	`image` text,
	`first_login` integer DEFAULT CURRENT_TIMESTAMP,
	`last_login` integer DEFAULT CURRENT_TIMESTAMP,
	`language` text DEFAULT 'en'
);
--> statement-breakpoint
CREATE INDEX `idx_question_feedback_quiz_id` ON `question_feedback` (`quiz_id`);--> statement-breakpoint
CREATE INDEX `idx_question_feedback_user_id` ON `question_feedback` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_quiz_created_at` ON `quiz` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_user_language_progress_last_practiced` ON `user_language_progress` (`last_practiced`);--> statement-breakpoint
CREATE UNIQUE INDEX `sqlite_autoindex_users_1` ON `users` (`provider_id`,`provider`);--> statement-breakpoint
CREATE INDEX `idx_users_last_login` ON `users` (`last_login`);