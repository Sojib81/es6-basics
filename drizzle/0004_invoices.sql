CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`booking_id` text,
	`customer_id` text NOT NULL,
	`bill_to_name` text NOT NULL,
	`bill_to_email` text,
	`bill_to_address` text,
	`line_items` text NOT NULL,
	`subtotal_cents` integer NOT NULL,
	`gst_cents` integer NOT NULL,
	`total_cents` integer NOT NULL,
	`deposit_applied_cents` integer DEFAULT 0 NOT NULL,
	`amount_due_cents` integer NOT NULL,
	`gst_registered` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`issued_at` text NOT NULL,
	`due_at` text NOT NULL,
	`paid_at` text,
	`paid_method` text,
	`public_token` text NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_number_unique` ON `invoices` (`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_public_token_unique` ON `invoices` (`public_token`);--> statement-breakpoint
CREATE INDEX `invoices_status_idx` ON `invoices` (`status`,`issued_at`);--> statement-breakpoint
CREATE INDEX `invoices_booking_idx` ON `invoices` (`booking_id`);