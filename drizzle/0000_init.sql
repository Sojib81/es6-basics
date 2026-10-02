CREATE TABLE `admin_users` (
	`email` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'owner' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sms_phone` text,
	`receive_sms_alerts` integer DEFAULT true NOT NULL,
	`receive_email_alerts` integer DEFAULT true NOT NULL,
	`receive_push_alerts` integer DEFAULT true NOT NULL,
	`last_seen_at` text
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_email` text NOT NULL,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text NOT NULL,
	`before` text,
	`after` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_entity_idx` ON `audit_log` (`entity`,`entity_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_created_idx` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `booking_assignees` (
	`booking_id` text NOT NULL,
	`admin_email` text NOT NULL,
	PRIMARY KEY(`booking_id`, `admin_email`),
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`admin_email`) REFERENCES `admin_users`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`ref` text NOT NULL,
	`type` text DEFAULT 'booking' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`booker_customer_id` text NOT NULL,
	`submitted_name` text NOT NULL,
	`submitted_email` text,
	`booker_role` text NOT NULL,
	`site_contact_name` text,
	`site_contact_phone` text,
	`pm_customer_id` text,
	`pm_name` text,
	`pm_agency` text,
	`bill_to` text DEFAULT 'booker' NOT NULL,
	`service` text NOT NULL,
	`bedrooms` integer,
	`bathrooms` integer,
	`storeys` integer,
	`carpet_rooms` integer,
	`agent_ready` integer DEFAULT false NOT NULL,
	`condition` text DEFAULT 'normal' NOT NULL,
	`addons` text DEFAULT '[]' NOT NULL,
	`preferred_date` text,
	`backup_date` text,
	`time_window` text,
	`address` text,
	`suburb` text,
	`access_notes` text,
	`access_notes_wiped_at` text,
	`notes` text,
	`heard_from` text,
	`estimate_cents` integer,
	`estimated_half_hours` integer,
	`line_items` text DEFAULT '[]' NOT NULL,
	`pricing_version_id` text,
	`pricing_snapshot` text,
	`quote_only` integer DEFAULT false NOT NULL,
	`final_price_cents` integer,
	`capacity_units` integer,
	`payment_choice` text DEFAULT 'later' NOT NULL,
	`deposit_status` text DEFAULT 'none' NOT NULL,
	`deposit_cents` integer,
	`stripe_session_id` text,
	`stripe_payment_intent_id` text,
	`refunded_cents` integer DEFAULT 0 NOT NULL,
	`paid_method` text DEFAULT 'unpaid' NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`scheduled_date` text,
	`scheduled_window` text,
	`first_response_at` text,
	`lost_reason` text,
	`completed_at` text,
	`utm_source` text,
	`utm_medium` text,
	`utm_campaign` text,
	`gclid` text,
	`fbclid` text,
	FOREIGN KEY (`booker_customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pm_customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_ref_unique` ON `bookings` (`ref`);--> statement-breakpoint
CREATE INDEX `bookings_status_idx` ON `bookings` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `bookings_scheduled_idx` ON `bookings` (`scheduled_date`,`scheduled_window`);--> statement-breakpoint
CREATE INDEX `bookings_booker_idx` ON `bookings` (`booker_customer_id`);--> statement-breakpoint
CREATE INDEX `bookings_stripe_session_idx` ON `bookings` (`stripe_session_id`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`email` text,
	`type` text DEFAULT 'individual' NOT NULL,
	`agency` text,
	`notes` text,
	`sms_opt_out` integer DEFAULT false NOT NULL,
	`sms_opt_out_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customers_phone_unique` ON `customers` (`phone`);--> statement-breakpoint
CREATE TABLE `enquiries` (
	`id` text PRIMARY KEY NOT NULL,
	`ref` text NOT NULL,
	`customer_id` text NOT NULL,
	`type` text NOT NULL,
	`submitted_name` text NOT NULL,
	`email` text,
	`phone` text NOT NULL,
	`subject` text,
	`message` text NOT NULL,
	`service_interest` text,
	`suburb` text,
	`agency` text,
	`status` text DEFAULT 'unread' NOT NULL,
	`booking_id` text,
	`utm_source` text,
	`utm_medium` text,
	`utm_campaign` text,
	`gclid` text,
	`fbclid` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `enquiries_ref_unique` ON `enquiries` (`ref`);--> statement-breakpoint
CREATE INDEX `enquiries_status_idx` ON `enquiries` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `message_templates` (
	`key` text PRIMARY KEY NOT NULL,
	`channel` text NOT NULL,
	`subject` text,
	`body` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`enquiry_id` text,
	`booking_id` text,
	`invoice_id` text,
	`direction` text NOT NULL,
	`channel` text NOT NULL,
	`recipient` text,
	`template_key` text,
	`subject` text,
	`body` text NOT NULL,
	`sent_by` text NOT NULL,
	`provider_id` text,
	`status` text NOT NULL,
	`error` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`enquiry_id`) REFERENCES `enquiries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `messages_booking_idx` ON `messages` (`booking_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `messages_enquiry_idx` ON `messages` (`enquiry_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `rate_counters` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings_history` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`old_value` text,
	`new_value` text NOT NULL,
	`changed_by` text NOT NULL,
	`changed_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `settings_history_key_idx` ON `settings_history` (`key`,`changed_at`);