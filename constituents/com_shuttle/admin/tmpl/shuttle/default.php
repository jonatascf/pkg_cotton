<?php
/**
 * @package Tabaoca.Component.Shuttle.Administrator
 * @subpackage com_shuttle
 * @copyright (C) 2024 Jonatas C. Ferreira
 * @license GNU Affero General Public License version 3 or later; see LICENSE.md
 */

use Joomla\CMS\Language\Text;

\defined('_JEXEC') or die;

?>

<!DOCTYPE html>
<html lang="<?php echo $this->language; ?>">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo htmlspecialchars(Text::_('COM_SHUTTLE_ADMIN_PAGE_TITLE'), ENT_QUOTES, 'UTF-8'); ?></title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background-color: #f5f5f5;
            color: #333;
            line-height: 1.6;
            padding: 20px;
        }

        .shuttle-admin-container {
            max-width: 1000px;
            margin: 0 auto;
            background-color: #fff;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            overflow: hidden;
        }

        .shuttle-admin-header {
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            color: #fff;
            padding: 30px;
            text-align: center;
        }

        .shuttle-admin-header h1 {
            font-size: 2.2rem;
            margin-bottom: 10px;
            text-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }

        .shuttle-admin-header p {
            font-size: 1.1rem;
            opacity: 0.95;
        }

        .shuttle-admin-content {
            padding: 30px;
        }

        .shuttle-admin-section {
            margin-bottom: 30px;
            padding: 25px;
            background-color: #fafafa;
            border-left: 4px solid #1e3c72;
            border-radius: 4px;
        }

        .shuttle-admin-section h2 {
            color: #1e3c72;
            font-size: 1.5rem;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .shuttle-admin-section h2 .shuttle-admin-icon {
            font-size: 1.8rem;
        }

        .shuttle-admin-section p {
            margin-bottom: 10px;
            color: #555;
        }

        .shuttle-admin-section ul {
            margin-left: 20px;
            margin-top: 10px;
        }

        .shuttle-admin-section ul li {
            margin-bottom: 8px;
            color: #555;
        }

        .shuttle-admin-warning-box {
            background-color: #fff3cd;
            border: 1px solid #ffc107;
            border-radius: 6px;
            padding: 20px;
            margin-top: 15px;
        }

        .shuttle-admin-warning-box h3 {
            color: #856404;
            margin-bottom: 10px;
            font-size: 1.1rem;
        }

        .shuttle-admin-warning-box ol {
            margin-left: 20px;
        }

        .shuttle-admin-warning-box ol li {
            margin-bottom: 8px;
            color: #856404;
        }

        .shuttle-admin-code-block {
            background-color: #2d2d2d;
            color: #f8f8f2;
            padding: 15px;
            border-radius: 6px;
            font-family: 'Courier New', monospace;
            font-size: 0.9rem;
            overflow-x: auto;
            margin-top: 10px;
        }

        .shuttle-admin-steps {
            background-color: #e3f2fd;
            border-left-color: #2196f3;
        }

        .shuttle-admin-steps ol {
            margin-left: 20px;
        }

        .shuttle-admin-steps ol li {
            margin-bottom: 12px;
            color: #333;
            font-weight: 500;
        }

        .shuttle-admin-steps ol li strong {
            color: #1565c0;
        }

        .shuttle-admin-footer {
            text-align: center;
            padding: 20px;
            color: #777;
            font-size: 0.9rem;
            border-top: 1px solid #eee;
        }

        @media (max-width: 768px) {
            body {
                padding: 10px;
            }

            .shuttle-admin-header h1 {
                font-size: 1.7rem;
            }

            .shuttle-admin-section {
                padding: 15px;
            }
        }
    </style>
</head>
<body>
    <div class="shuttle-admin-container">
        <div class="shuttle-admin-header">
            <h1><?php echo htmlspecialchars(Text::_('COM_SHUTTLE_ADMIN_HEADER_TITLE'), ENT_QUOTES, 'UTF-8'); ?></h1>
            <p><?php echo htmlspecialchars(Text::_('COM_SHUTTLE_ADMIN_HEADER_SUBTITLE'), ENT_QUOTES, 'UTF-8'); ?></p>
        </div>

        <div class="shuttle-admin-content">
            <div class="shuttle-admin-section">
                <h2><span class="shuttle-admin-icon">&#128187;</span> <?php echo htmlspecialchars(Text::_('COM_SHUTTLE_ADMIN_WHAT_IS_TITLE'), ENT_QUOTES, 'UTF-8'); ?></h2>
                <p><?php echo htmlspecialchars(Text::_('COM_SHUTTLE_ADMIN_WHAT_IS_DESC'), ENT_QUOTES, 'UTF-8'); ?></p>
                <p><?php echo htmlspecialchars(Text::_('COM_SHUTTLE_ADMIN_WHAT_IS_FEATURES'), ENT_QUOTES, 'UTF-8'); ?></p>
                <ul>
                    <li><?php echo htmlspecialchars(Text::_('COM_SHUTTLE_ADMIN_WHAT_IS_FEATURE_1'), ENT_QUOTES, 'UTF-8'); ?></li>
                    <li><?php echo htmlspecialchars(Text::_('COM_SHUTTLE_ADMIN_WHAT_IS_FEATURE_2'), ENT_QUOTES, 'UTF-8'); ?></li>
                    <li><?php echo htmlspecialchars(Text::_('COM_SHUTTLE_ADMIN_WHAT_IS_FEATURE_3'), ENT_QUOTES, 'UTF-8'); ?></li>
                </ul>
            </div>

            <div class="shuttle-admin-section shuttle-admin-steps">
                <h2><span class="shuttle-admin-icon">&#9881;</span> <?php echo htmlspecialchars(Text::_('COM_SHUTTLE_ADMIN_MCP_SETUP_TITLE'), ENT_QUOTES, 'UTF-8'); ?></h2>
                <p><?php echo htmlspecialchars(Text::_('COM_SHUTTLE_ADMIN_MCP_SETUP_DESC'), ENT_QUOTES, 'UTF-8'); ?></p>
                <ol>
                    <li><?php echo htmlspecialchars(Text::_('COM_SHUTTLE_ADMIN_MCP_SETUP_STEP_1'), ENT_QUOTES, 'UTF-8'); ?></li>
                    <li><?php echo htmlspecialchars(Text::_('COM_SHUTTLE_ADMIN_MCP_SETUP_STEP_2'), ENT_QUOTES, 'UTF-8'); ?></li>
                    <li><?php echo htmlspecialchars(Text::_('COM_SHUTTLE_ADMIN_MCP_SETUP_STEP_3'), ENT_QUOTES, 'UTF-8'); ?></li>
                    <li><?php echo htmlspecialchars(Text::_('COM_SHUTTLE_ADMIN_MCP_SETUP_STEP_4'), ENT_QUOTES, 'UTF-8'); ?></li>
                    <li><?php echo htmlspecialchars(Text::_('COM_SHUTTLE_ADMIN_MCP_SETUP_STEP_5'), ENT_QUOTES, 'UTF-8'); ?></li>
                    <li><?php echo htmlspecialchars(Text::_('COM_SHUTTLE_ADMIN_MCP_SETUP_STEP_6'), ENT_QUOTES, 'UTF-8'); ?></li>
                </ol>

                <div class="shuttle-admin-warning-box">
                    <h3>&#128274; <?php echo htmlspecialchars(Text::_('COM_SHUTTLE_ADMIN_MCP_SETUP_NOTE_TITLE'), ENT_QUOTES, 'UTF-8'); ?></h3>
                    <p><?php echo htmlspecialchars(Text::_('COM_SHUTTLE_ADMIN_MCP_SETUP_NOTE_DESC'), ENT_QUOTES, 'UTF-8'); ?></p>
                </div>
            </div>

            <div class="shuttle-admin-section">
                <h2><span class="shuttle-admin-icon">&#128274;</span> <?php echo htmlspecialchars(Text::_('COM_SHUTTLE_ADMIN_GUIDE_TITLE'), ENT_QUOTES, 'UTF-8'); ?></h2>
                <p><?php echo htmlspecialchars(Text::_('COM_SHUTTLE_ADMIN_GUIDE_DESC'), ENT_QUOTES, 'UTF-8'); ?></p>
                <ul>
                    <li><?php echo htmlspecialchars(Text::_('COM_SHUTTLE_ADMIN_GUIDE_ITEM_1'), ENT_QUOTES, 'UTF-8'); ?></li>
                    <li><?php echo htmlspecialchars(Text::_('COM_SHUTTLE_ADMIN_GUIDE_ITEM_2'), ENT_QUOTES, 'UTF-8'); ?></li>
                    <li><?php echo htmlspecialchars(Text::_('COM_SHUTTLE_ADMIN_GUIDE_ITEM_3'), ENT_QUOTES, 'UTF-8'); ?></li>
                    <li><?php echo htmlspecialchars(Text::_('COM_SHUTTLE_ADMIN_GUIDE_ITEM_4'), ENT_QUOTES, 'UTF-8'); ?></li>
                </ul>

                <div class="shuttle-admin-code-block">
                    <?php echo htmlspecialchars(Text::_('COM_SHUTTLE_ADMIN_GUIDE_CODE_LINE_1'), ENT_QUOTES, 'UTF-8'); ?><br>
                    <?php echo htmlspecialchars(Text::_('COM_SHUTTLE_ADMIN_GUIDE_CODE_LINE_2'), ENT_QUOTES, 'UTF-8'); ?><br>
                    <?php echo htmlspecialchars(Text::_('COM_SHUTTLE_ADMIN_GUIDE_CODE_LINE_3'), ENT_QUOTES, 'UTF-8'); ?><br>
                    <?php echo htmlspecialchars(Text::_('COM_SHUTTLE_ADMIN_GUIDE_CODE_LINE_4'), ENT_QUOTES, 'UTF-8'); ?>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
