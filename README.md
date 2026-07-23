# venera-configs

Configuration file repository for venera

## Source lists

- `index.json`: curated sources that pass the core browse, details, chapter, and image checks.
- `adult-index.json`: adult sources, installed only when needed.
- `experimental-index.json`: sources that need login, Cloudflare verification, a compatible region, or further stability work.

Use the raw or jsDelivr URL of the required JSON file as the repository URL in Venera. Switching lists does not remove sources that are already installed.

- Curated: `https://cdn.jsdelivr.net/gh/cattoldme/venera-configs@main/index.json`
- Adult: `https://cdn.jsdelivr.net/gh/cattoldme/venera-configs@main/adult-index.json`
- Experimental: `https://cdn.jsdelivr.net/gh/cattoldme/venera-configs@main/experimental-index.json`

## Create a new configuration

1. Download `_template_.js`, `_venera_.js`, put them in the same directory
2. Rename `_template_.js` to `your_config_name.js`
3. Edit `your_config_name.js` to your needs. 
   - The `_template_.js` file contains comments to help you with that. 
   - The `_venera_.js` is used for code completion in your IDE.
