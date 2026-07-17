CREATE TABLE `neighborhoods` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_secret` text NOT NULL,
	`name` text,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`rotation_hour` integer DEFAULT 7 NOT NULL,
	`palette_id` text,
	`custom_colors` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`palette_id`) REFERENCES `palettes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `neighborhoods_admin_secret_unique` ON `neighborhoods` (`admin_secret`);--> statement-breakpoint
CREATE TABLE `palette_colors` (
	`id` text PRIMARY KEY NOT NULL,
	`palette_id` text NOT NULL,
	`hex` text NOT NULL,
	`name` text,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`palette_id`) REFERENCES `palettes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `palettes` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`is_default` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `palettes_slug_unique` ON `palettes` (`slug`);