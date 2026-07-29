# Cotton Cloud

Cotton Cloud is a cloud-based file storage system developed for Joomla!. It provides a comprehensive media management solution that integrates AI capabilities, enabling administrators and editors to manage files, folders, and media assets efficiently.

## Package Contents

This package includes the following extensions:

### com_cotton
The core component responsible for file and folder management. It provides the main storage infrastructure, allowing administrators to organize, upload, and manage digital assets through an intuitive interface.

### com_shuttle
A command-bridge component that connects the Cotton system with external services via a structured protocol. It handles command interpretation, AI streaming, and interaction with the Cotton storage layer.

### com_weaver
A rich text editor component built on CodeMirror, providing an AI-assisted writing environment. Weaver acts as a CodeMirror-based plugin that enhances the Joomla editing experience with intelligent automation, AI integration, and advanced code-editing capabilities.

### mod_cotton
A site module that displays Cotton Cloud content to visitors. It can be used to present shared files or media directories on the front end of your website.

### plg_cotton
An editors-xtd plugin that adds a **Cotton** button to the Joomla article editor. This button grants quick access to the Cotton media selector, allowing authors to browse and insert files directly into their articles without leaving the editor.

### lib_cotton
A shared library that provides common functionality used by all Cotton components.

## Installation

1. Download and extract the `pkg_cotton.zip` package.
2. In the Joomla administrator panel, go to **System > Install > Extensions**.
3. Upload the package file and complete the installation.
4. After installation, open **System > Update > Extensions** and click **Refresh** to ensure all constituent extensions are properly registered.

## Configuration

### Enabling the MCP Assistant

To enable the MCP Assistant, create a custom field in the user profile to store the Kilo Code API Key.

1. In the Joomla administrator, access the **Custom Fields Manager** via **Users > Fields**.
2. Click **New** to create a new field.
3. Create a new **Text** or **Password** field.
4. Set the field name as: `kilocode-api-key`.
5. Use a label such as: `Kilo Code API Key`.
6. Assign this field to the user group that will have access to the Shuttle component.
7. Save and publish the field.

Once published, each authorized user can add their key in the **Custom Fields** tab of their user profile.

### Enabling the Editors-XTD Button

To make the **Insert Media** button available in the article editor:

1. Go to **System > Manage > Plugins**.
2. Search for the **Cotton** plugin under the **editors-xtd** group.
3. Set the plugin status to **Enabled**.
4. Visit any article edit page. The **Cotton** button will now appear in the **CMS Content** toolbar. Clicking it opens the media selector linked to com_cotton.

### Publishing the mod_cotton Module

To display Cotton content on your site:

1. In the Joomla administrator, go to **Content > Site Modules**.
2. Click **New** and search for the **Cotton** module.
3. In the module settings, select the desired menu assignment, position, and access level.
4. Configure the module parameters according to the content you wish to display.
5. Save and assign the module to one or more pages.

## License

GNU General Public License version 3 or later; see [LICENCE.md](LICENCE.md).

## Uninstall Warning

Uninstalling the Cotton Cloud package will **completely remove** all database tables, files, and folders associated with the Cotton ecosystem. This action is irreversible.
