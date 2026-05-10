<?php
/**
 * Memory Mint — additions for wp-config.php
 *
 * Copy the lines below into your wp-config.php BEFORE the
 * "That's all, stop editing!" line.
 *
 * Do NOT copy this whole file — only the define() calls you need.
 */

// ── Performance
define( 'WP_MEMORY_LIMIT',     '256M' );
define( 'WP_MAX_MEMORY_LIMIT', '512M' );
define( 'FS_METHOD',           'direct' );   // skip FTP prompts

// ── Debugging (safe for production — logs to wp-content/debug.log, never shown to users)
if ( ! defined( 'WP_DEBUG' ) )         define( 'WP_DEBUG',         false );
if ( ! defined( 'WP_DEBUG_LOG' ) )     define( 'WP_DEBUG_LOG',     true  );
if ( ! defined( 'WP_DEBUG_DISPLAY' ) ) define( 'WP_DEBUG_DISPLAY', false );

// ── Environment tag (used by some plugins/themes to detect local vs production)
// Change to 'production' on your live server
define( 'WP_ENVIRONMENT_TYPE', 'local' );  // or 'production'

// ── Midnight async jobs (PRODUCTION VPS ONLY)
// Disabling WP's built-in cron prevents Midnight job timeouts caused by Nginx's
// fastcgi_read_timeout. Jobs are instead run by a real system cron (see below).
// Do NOT set this locally — it will break WP Cron for all other plugins.
//
// Add to system crontab on the VPS:
//   * * * * * www-data wp cron event run --due-now --path=/var/www/html >> /var/log/wp-cron.log 2>&1
//
// define( 'DISABLE_WP_CRON', true );

// ── PHP extension requirements (check these are available on your host)
// Memory Mint requires:
//   - sodium   (PHP 7.2+ built-in, needed for CIP-8 wallet signature verification)
//   - openssl  (standard, needed for AES-256-GCM key encryption)
//   - mysqli   (standard WordPress requirement)
