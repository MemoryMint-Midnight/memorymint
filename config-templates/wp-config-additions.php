<?php
/**
 * Memory Mint â€” additions for wp-config.php
 *
 * Copy the lines below into your wp-config.php BEFORE the
 * "That's all, stop editing!" line.
 *
 * Do NOT copy this whole file â€” only the define() calls you need.
 */

// â”€â”€ Performance
define( 'WP_MEMORY_LIMIT',     '256M' );
define( 'WP_MAX_MEMORY_LIMIT', '512M' );
define( 'FS_METHOD',           'direct' );   // skip FTP prompts

// â”€â”€ Debugging (safe for production â€” logs to wp-content/debug.log, never shown to users)
if ( ! defined( 'WP_DEBUG' ) )         define( 'WP_DEBUG',         false );
if ( ! defined( 'WP_DEBUG_LOG' ) )     define( 'WP_DEBUG_LOG',     true  );
if ( ! defined( 'WP_DEBUG_DISPLAY' ) ) define( 'WP_DEBUG_DISPLAY', false );

// â”€â”€ Environment tag (used by some plugins/themes to detect local vs production)
// Change to 'production' on your live server
define( 'WP_ENVIRONMENT_TYPE', 'local' );  // or 'production'
