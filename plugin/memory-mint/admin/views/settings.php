<?php
if (!defined('ABSPATH')) {
    exit;
}

$network        = get_option('memorymint_network', 'preprod');
$anvil_test     = isset($_GET['anvil_test'])     ? sanitize_text_field($_GET['anvil_test'])     : '';
$email_test     = isset($_GET['email_test'])     ? sanitize_text_field($_GET['email_test'])     : '';
$email_to       = isset($_GET['to'])             ? sanitize_email($_GET['to'])                  : '';
$midnight_test  = isset($_GET['midnight_test'])  ? sanitize_text_field($_GET['midnight_test'])  : '';
?>

<div class="wrap memorymint-admin">
    <h1>Memory Mint Settings</h1>

    <?php if ($anvil_test === 'success'): ?>
        <div class="notice notice-success is-dismissible">
            <p><strong>Anvil API connection successful!</strong></p>
        </div>
    <?php elseif ($anvil_test === 'failed'): ?>
        <div class="notice notice-error is-dismissible">
            <p><strong>Anvil API connection failed.</strong> HTTP code: <?php echo esc_html($_GET['code'] ?? 'unknown'); ?></p>
        </div>
    <?php elseif ($anvil_test === 'no_key'): ?>
        <div class="notice notice-warning is-dismissible">
            <p><strong>No API key configured for the current network.</strong> Please enter your Anvil API key below.</p>
        </div>
    <?php elseif ($anvil_test === 'error'): ?>
        <div class="notice notice-error is-dismissible">
            <p><strong>Connection error:</strong> <?php echo esc_html($_GET['msg'] ?? 'Unknown error'); ?></p>
        </div>
    <?php endif; ?>

    <?php if ($midnight_test === 'success'): ?>
        <div class="notice notice-success is-dismissible">
            <p><strong>Midnight sidecar reachable!</strong> Health check passed.</p>
        </div>
    <?php elseif ($midnight_test === 'failed'): ?>
        <div class="notice notice-error is-dismissible">
            <p><strong>Midnight sidecar unreachable.</strong> HTTP code: <?php echo esc_html($_GET['code'] ?? 'unknown'); ?></p>
        </div>
    <?php elseif ($midnight_test === 'no_config'): ?>
        <div class="notice notice-warning is-dismissible">
            <p><strong>Sidecar URL or API secret is not configured.</strong> Fill in both fields below and save first.</p>
        </div>
    <?php elseif ($midnight_test === 'error'): ?>
        <div class="notice notice-error is-dismissible">
            <p><strong>Midnight connection error:</strong> <?php echo esc_html($_GET['msg'] ?? 'Unknown error'); ?></p>
        </div>
    <?php endif; ?>

    <?php if ($email_test === 'sent'): ?>
        <div class="notice notice-success is-dismissible">
            <p><strong>Test email sent</strong> to <code><?php echo esc_html($email_to); ?></code>. Check your inbox — if it doesn't arrive, your mail server or SMTP plugin needs attention.</p>
        </div>
    <?php elseif ($email_test === 'failed'): ?>
        <div class="notice notice-error is-dismissible">
            <p><strong>Test email failed to send.</strong> WordPress <code>wp_mail()</code> returned false. Install and configure an SMTP plugin (e.g. WP Mail SMTP) to fix email delivery.</p>
        </div>
    <?php endif; ?>

    <?php settings_errors(); ?>

    <form method="post" action="options.php">
        <?php settings_fields('memorymint_settings'); ?>

        <h2>General</h2>
        <table class="form-table">
            <tr>
                <th><label for="memorymint_network">Network</label></th>
                <td>
                    <select name="memorymint_network" id="memorymint_network">
                        <option value="preprod" <?php selected($network, 'preprod'); ?>>Preprod (Testnet)</option>
                        <option value="mainnet" <?php selected($network, 'mainnet'); ?>>Mainnet</option>
                    </select>
                    <p class="description">Choose the Cardano network. Use Preprod for testing.</p>
                </td>
            </tr>
            <tr>
                <th><label for="memorymint_merchant_address">Merchant Wallet Address</label></th>
                <td>
                    <input type="text" name="memorymint_merchant_address" id="memorymint_merchant_address"
                        value="<?php echo esc_attr(get_option('memorymint_merchant_address', '')); ?>"
                        class="large-text" placeholder="addr_test1..." />
                    <p class="description">Wallet address that receives service fee payments (in ADA).</p>
                </td>
            </tr>
            <tr>
                <th>Service Fees (USD)</th>
                <td>
                    <table style="border-collapse:collapse;">
                        <tr>
                            <th style="padding:4px 12px 4px 0; font-weight:600; text-align:left;"></th>
                            <th style="padding:4px 16px 4px 0; font-weight:600; color:#555;">Per mint</th>
                            <th style="padding:4px 0; font-weight:600; color:#555;">Batch of 5 (total)</th>
                        </tr>
                        <tr>
                            <td style="padding:6px 12px 6px 0;"><label>🖼 Image</label></td>
                            <td style="padding:6px 16px 6px 0;">$<input type="number" name="memorymint_service_fee_image" id="memorymint_service_fee_image"
                                value="<?php echo esc_attr(get_option('memorymint_service_fee_image', '2.50')); ?>"
                                step="0.01" min="0" class="small-text" /></td>
                            <td style="padding:6px 0;">$<input type="number" name="memorymint_service_fee_image_batch" id="memorymint_service_fee_image_batch"
                                value="<?php echo esc_attr(get_option('memorymint_service_fee_image_batch', '10.00')); ?>"
                                step="0.01" min="0" class="small-text" /></td>
                        </tr>
                        <tr>
                            <td style="padding:6px 12px 6px 0;"><label>🎬 Video</label></td>
                            <td style="padding:6px 16px 6px 0;">$<input type="number" name="memorymint_service_fee_video" id="memorymint_service_fee_video"
                                value="<?php echo esc_attr(get_option('memorymint_service_fee_video', '5.00')); ?>"
                                step="0.01" min="0" class="small-text" /></td>
                            <td style="padding:6px 0;">$<input type="number" name="memorymint_service_fee_video_batch" id="memorymint_service_fee_video_batch"
                                value="<?php echo esc_attr(get_option('memorymint_service_fee_video_batch', '20.00')); ?>"
                                step="0.01" min="0" class="small-text" /></td>
                        </tr>
                        <tr>
                            <td style="padding:6px 12px 6px 0;"><label>🎵 Audio</label></td>
                            <td style="padding:6px 16px 6px 0;">$<input type="number" name="memorymint_service_fee_audio" id="memorymint_service_fee_audio"
                                value="<?php echo esc_attr(get_option('memorymint_service_fee_audio', '2.50')); ?>"
                                step="0.01" min="0" class="small-text" /></td>
                            <td style="padding:6px 0;">$<input type="number" name="memorymint_service_fee_audio_batch" id="memorymint_service_fee_audio_batch"
                                value="<?php echo esc_attr(get_option('memorymint_service_fee_audio_batch', '10.00')); ?>"
                                step="0.01" min="0" class="small-text" /></td>
                        </tr>
                    </table>
                    <p class="description">Batch rate applies only when all 5 uploaded files are the same type. Mixed batches use per-mint rates.</p>
                </td>
            </tr>
            <tr>
                <th><label for="memorymint_production_url">Production Frontend URL</label></th>
                <td>
                    <input type="url" name="memorymint_production_url" id="memorymint_production_url"
                        value="<?php echo esc_attr(get_option('memorymint_production_url', '')); ?>"
                        class="large-text" placeholder="https://memorymint.io" />
                    <p class="description">Your production Next.js URL (for CORS). Localhost is always allowed.</p>
                </td>
            </tr>
        </table>

        <h2>Anvil API Keys</h2>
        <table class="form-table">
            <tr>
                <th><label for="memorymint_anvil_api_key_preprod">Preprod API Key</label></th>
                <td>
                    <input type="password" name="memorymint_anvil_api_key_preprod" id="memorymint_anvil_api_key_preprod"
                        value="<?php echo esc_attr(get_option('memorymint_anvil_api_key_preprod', '')); ?>"
                        class="large-text" />
                </td>
            </tr>
            <tr>
                <th><label for="memorymint_anvil_api_key_mainnet">Mainnet API Key</label></th>
                <td>
                    <input type="password" name="memorymint_anvil_api_key_mainnet" id="memorymint_anvil_api_key_mainnet"
                        value="<?php echo esc_attr(get_option('memorymint_anvil_api_key_mainnet', '')); ?>"
                        class="large-text" />
                </td>
            </tr>
            <tr>
                <th>Test Connection</th>
                <td>
                    <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="display:inline;">
                        <?php wp_nonce_field('memorymint_test_anvil'); ?>
                        <input type="hidden" name="action" value="memorymint_test_anvil" />
                        <button type="submit" class="button">Test Anvil API (<?php echo esc_html($network); ?>)</button>
                    </form>
                </td>
            </tr>
        </table>

        <h2>Midnight Sidecar</h2>
        <table class="form-table">
            <tr>
                <th><label for="memorymint_midnight_sidecar_url">Sidecar URL</label></th>
                <td>
                    <input type="url" name="memorymint_midnight_sidecar_url" id="memorymint_midnight_sidecar_url"
                        value="<?php echo esc_attr(get_option('memorymint_midnight_sidecar_url', '')); ?>"
                        class="large-text" placeholder="http://localhost:4000" />
                    <p class="description">Base URL of the Midnight sidecar Express service (e.g. <code>http://localhost:4000</code> or your tunnel URL).</p>
                </td>
            </tr>
            <tr>
                <th><label for="memorymint_midnight_api_secret">API Secret</label></th>
                <td>
                    <input type="password" name="memorymint_midnight_api_secret" id="memorymint_midnight_api_secret"
                        value="<?php echo esc_attr(get_option('memorymint_midnight_api_secret', '')); ?>"
                        class="large-text" />
                    <p class="description">Matches the <code>API_SECRET</code> in the sidecar <code>.env</code>. Sent as <code>x-api-secret</code> header.</p>
                </td>
            </tr>
            <tr>
                <th>Test Connection</th>
                <td>
                    <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="display:inline;">
                        <?php wp_nonce_field('memorymint_test_midnight'); ?>
                        <input type="hidden" name="action" value="memorymint_test_midnight" />
                        <button type="submit" class="button">Test Midnight Sidecar</button>
                    </form>
                    <p class="description">Calls <code>/health</code> on the sidecar. Save your settings first, then test.</p>
                </td>
            </tr>
        </table>

        <h2>Email / SMTP</h2>
        <table class="form-table">
            <tr>
                <th>Test Email Delivery</th>
                <td>
                    <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="display:inline;">
                        <?php wp_nonce_field('memorymint_test_email'); ?>
                        <input type="hidden" name="action" value="memorymint_test_email" />
                        <button type="submit" class="button">Send Test Email to <?php echo esc_html(get_option('admin_email')); ?></button>
                    </form>
                    <p class="description">Sends a test message via <code>wp_mail()</code>. OTP codes and share invitations use the same mechanism — if this fails, install an SMTP plugin.</p>
                </td>
            </tr>
        </table>

        <h2>File Size Limits</h2>
        <table class="form-table">
            <tr>
                <th><label for="memorymint_max_image_size">Max Image Size (bytes)</label></th>
                <td>
                    <input type="number" name="memorymint_max_image_size" id="memorymint_max_image_size"
                        value="<?php echo esc_attr(get_option('memorymint_max_image_size', '10485760')); ?>"
                        class="regular-text" />
                    <p class="description">Default: 10485760 (10MB)</p>
                </td>
            </tr>
            <tr>
                <th><label for="memorymint_max_video_size">Max Video Size (bytes)</label></th>
                <td>
                    <input type="number" name="memorymint_max_video_size" id="memorymint_max_video_size"
                        value="<?php echo esc_attr(get_option('memorymint_max_video_size', '52428800')); ?>"
                        class="regular-text" />
                    <p class="description">Default: 52428800 (50MB)</p>
                </td>
            </tr>
            <tr>
                <th><label for="memorymint_max_audio_size">Max Audio Size (bytes)</label></th>
                <td>
                    <input type="number" name="memorymint_max_audio_size" id="memorymint_max_audio_size"
                        value="<?php echo esc_attr(get_option('memorymint_max_audio_size', '10485760')); ?>"
                        class="regular-text" />
                    <p class="description">Default: 10485760 (10MB)</p>
                </td>
            </tr>
        </table>

        <h2>Data Management</h2>
        <table class="form-table">
            <tr>
                <th><label for="memorymint_delete_data_on_deactivate">Delete Data on Deactivation</label></th>
                <td>
                    <label>
                        <input type="checkbox" name="memorymint_delete_data_on_deactivate" id="memorymint_delete_data_on_deactivate"
                            value="1" <?php checked(get_option('memorymint_delete_data_on_deactivate', false)); ?> />
                        Remove all plugin data (tables, options, roles) when deactivating.
                    </label>
                    <p class="description" style="color: #d63638;"><strong>Warning:</strong> This will permanently delete all keepsake records, transactions, and policy wallets.</p>
                </td>
            </tr>
        </table>

        <?php submit_button('Save Settings'); ?>
    </form>

    <hr />
    <h2>API Information</h2>
    <table class="form-table">
        <tr>
            <th>REST API Base</th>
            <td><code><?php echo esc_html(rest_url('memorymint/v1/')); ?></code></td>
        </tr>
        <tr>
            <th>Current Network</th>
            <td><strong><?php echo esc_html(ucfirst($network)); ?></strong></td>
        </tr>
        <tr>
            <th>Plugin Version</th>
            <td><?php echo esc_html(MEMORYMINT_VERSION); ?></td>
        </tr>
    </table>
</div>
