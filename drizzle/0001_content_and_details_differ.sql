CREATE TABLE `faqs` (
	`id` text PRIMARY KEY NOT NULL,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`service_slug` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE INDEX `faqs_service_idx` ON `faqs` (`service_slug`,`sort_order`);--> statement-breakpoint
CREATE TABLE `policies` (
	`slug` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`service_key` text,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`body` text NOT NULL,
	`hero_media_id` text,
	`checklist` text DEFAULT '[]' NOT NULL,
	`not_included` text DEFAULT '[]' NOT NULL,
	`price_from_cents` integer,
	`bookable` integer DEFAULT true NOT NULL,
	`capacity_weight` integer DEFAULT 1 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`seo_title` text,
	`seo_description` text,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `services_slug_unique` ON `services` (`slug`);--> statement-breakpoint
ALTER TABLE `bookings` ADD `customer_details_differ` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `enquiries` ADD `customer_details_differ` integer DEFAULT false NOT NULL;