<?php
/**
 * Plugin Name: Memory Mint
 * Plugin URI: https://memorymint.io
 * Description: Mint precious moments as permanent digital keepsakes on Cardano and Midnight. Backend API for the Memory Mint Next.js frontend.
 * Version: 1.1.4
 * Author: Memory Mint
 * Author URI: https://memorymint.io
 * License: GPL v2 or later
 * Text Domain: memory-mint
 * Requires at least: 5.9
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) {
    exit;
}

// Plugin constants
define('MEMORYMINT_VERSION', '1.1.4');
define('MEMORYMINT_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('MEMORYMINT_PLUGIN_URL', plugin_dir_url(__FILE__));
define('MEMORYMINT_PLUGIN_BASENAME', plugin_basename(__FILE__));

// Autoload classes
spl_autoload_register(function ($class) {
    $prefix = 'MemoryMint\\';
    $base_dir = MEMORYMINT_PLUGIN_DIR . 'includes/';

    $len = strlen($prefix);
    if (strncmp($prefix, $class, $len) !== 0) {
        return;
    }

    $relative_class = substr($class, $len);
    $file = $base_dir . str_replace('\\', '/', $relative_class) . '.php';

    // Convert CamelCase class names to file naming convention
    // e.g., MemoryMint\Api\AuthApi -> includes/api/class-auth-api.php
    $parts = explode('\\', $relative_class);
    $class_name = array_pop($parts);
    $sub_dir = strtolower(implode('/', $parts));

    // Convert CamelCase to kebab-case for filename
    $file_name = 'class-' . strtolower(preg_replace('/([a-z])([A-Z])/', '$1-$2', $class_name)) . '.php';

    if ($sub_dir) {
        $file = $base_dir . $sub_dir . '/' . $file_name;
    } else {
        $file = $base_dir . $file_name;
    }

    if (file_exists($file)) {
        require_once $file;
        return;
    }

    // Fallback: check plugin root directories (e.g., admin/)
    $alt_file = MEMORYMINT_PLUGIN_DIR . $sub_dir . '/' . $file_name;
    if (file_exists($alt_file)) {
        require_once $alt_file;
    }
});

// Load PHP-Cardano library
require_once MEMORYMINT_PLUGIN_DIR . 'includes/lib/Ed25519Pure.php';
require_once MEMORYMINT_PLUGIN_DIR . 'includes/lib/Ed25519Compat.php';
require_once MEMORYMINT_PLUGIN_DIR . 'includes/lib/CardanoWalletPHP.php';
require_once MEMORYMINT_PLUGIN_DIR . 'includes/lib/CardanoTransactionSignerPHP.php';

// Activation hook
register_activation_hook(__FILE__, function () {
    $activator = new MemoryMint\Activator();
    $activator->activate();
});

// Deactivation hook
register_deactivation_hook(__FILE__, function () {
    $deactivator = new MemoryMint\Deactivator();
    $deactivator->deactivate();
});

// Initialize plugin
add_action('plugins_loaded', function () {
    $plugin = MemoryMint\MemoryMint::get_instance();
    $plugin->init();
});
