<?php
if (!defined('ABSPATH')) {
    exit;
}

global $wpdb;
$table      = $wpdb->prefix . 'memorymint_transactions';
$k_table    = $wpdb->prefix . 'memorymint_keepsakes';

$page_num = isset($_GET['paged']) ? max(1, intval($_GET['paged'])) : 1;
$per_page = 20;
$offset   = ($page_num - 1) * $per_page;

$total = $wpdb->get_var("SELECT COUNT(*) FROM $table");
$transactions = $wpdb->get_results($wpdb->prepare(
    "SELECT t.*, u.user_email, k.title AS keepsake_title
     FROM $table t
     LEFT JOIN {$wpdb->users} u ON t.user_id = u.ID
     LEFT JOIN $k_table k ON t.keepsake_id = k.id
     ORDER BY t.created_at DESC
     LIMIT %d OFFSET %d",
    $per_page,
    $offset
));

$total_pages = ceil($total / $per_page);

$status_styles = [
    'confirmed' => 'background:#d1fae5; color:#065f46; padding:2px 8px; border-radius:4px; font-size:12px;',
    'failed'    => 'background:#fee2e2; color:#991b1b; padding:2px 8px; border-radius:4px; font-size:12px;',
    'pending'   => 'background:#fef3c7; color:#92400e; padding:2px 8px; border-radius:4px; font-size:12px;',
];
?>

<div class="wrap memorymint-admin">
    <h1>Transactions <span class="count">(<?php echo intval($total); ?>)</span></h1>

    <table class="wp-list-table widefat fixed striped">
        <thead>
            <tr>
                <th style="width:40px">ID</th>
                <th>User</th>
                <th>Keepsake</th>
                <th>Type</th>
                <th>Fee (USD)</th>
                <th>Network</th>
                <th>Status</th>
                <th>TX Hash</th>
                <th>Date</th>
            </tr>
        </thead>
        <tbody>
            <?php if (empty($transactions)): ?>
                <tr><td colspan="9">No transactions found.</td></tr>
            <?php else: ?>
                <?php foreach ($transactions as $tx): ?>
                    <tr>
                        <td><?php echo intval($tx->id); ?></td>
                        <td><?php echo esc_html($tx->user_email ?? 'Unknown'); ?></td>
                        <td>
                            <?php if ($tx->keepsake_title): ?>
                                <strong><?php echo esc_html($tx->keepsake_title); ?></strong>
                            <?php else: ?>
                                <span style="color:#999;">—</span>
                            <?php endif; ?>
                        </td>
                        <td><?php echo esc_html(ucfirst($tx->tx_type)); ?></td>
                        <td>$<?php echo esc_html(number_format(floatval($tx->service_fee_usd), 2)); ?></td>
                        <td><?php echo esc_html(ucfirst($tx->network)); ?></td>
                        <td>
                            <?php
                            $style = $status_styles[$tx->status] ?? $status_styles['pending'];
                            ?>
                            <span style="<?php echo esc_attr($style); ?>">
                                <?php echo esc_html(ucfirst($tx->status)); ?>
                            </span>
                            <?php if ($tx->status === 'failed' && !empty($tx->error_message)): ?>
                                <br><small style="color:#991b1b; font-size:11px;" title="<?php echo esc_attr($tx->error_message); ?>">
                                    <?php echo esc_html(strlen($tx->error_message) > 80 ? substr($tx->error_message, 0, 80) . '…' : $tx->error_message); ?>
                                </small>
                            <?php endif; ?>
                        </td>
                        <td>
                            <?php if ($tx->tx_hash): ?>
                                <?php $explorer = $tx->network === 'mainnet' ? 'https://cardanoscan.io' : 'https://preprod.cardanoscan.io'; ?>
                                <a href="<?php echo esc_url($explorer . '/transaction/' . $tx->tx_hash); ?>" target="_blank">
                                    <?php echo esc_html(substr($tx->tx_hash, 0, 16) . '…'); ?>
                                </a>
                            <?php else: ?>
                                —
                            <?php endif; ?>
                        </td>
                        <td><?php echo esc_html(date('M j, Y H:i', strtotime($tx->created_at))); ?></td>
                    </tr>
                <?php endforeach; ?>
            <?php endif; ?>
        </tbody>
    </table>

    <?php if ($total_pages > 1): ?>
        <div class="tablenav bottom">
            <div class="tablenav-pages">
                <?php
                echo paginate_links([
                    'base'    => add_query_arg('paged', '%#%'),
                    'format'  => '',
                    'current' => $page_num,
                    'total'   => $total_pages,
                ]);
                ?>
            </div>
        </div>
    <?php endif; ?>
</div>
