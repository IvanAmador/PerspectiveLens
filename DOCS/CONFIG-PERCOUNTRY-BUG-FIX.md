# Bug Fix: perCountry Countries Not Being Removed

## Problem Description

When users removed countries from the selected list in the options page and clicked "Save Settings", the countries appeared to be saved correctly in the immediate verification. However, when reloading the extension or the options page, the removed countries would reappear.

## Root Cause Analysis

The bug was caused by the `deepMerge` function behavior in both `ConfigManager` and `pipeline.js`. There were **THREE places** where `deepMerge` was incorrectly merging `perCountry` objects:

### Issue 1: In `save()` method (Line 61)
```javascript
// Step 2: Merge ONLY userConfigs (supports partial updates)
const mergedUserConfig = this.deepMerge(existingUserConfig, config);
```

**Problem**: When saving, the new config with removed countries was merged with the existing config. Since `perCountry` is an object where keys are country codes, `deepMerge` would:
- Add new countries from the incoming config
- Update existing countries from the incoming config
- **BUT NEVER REMOVE** countries that exist in `existingUserConfig` but not in the incoming config

**Example**:
```javascript
existing = { perCountry: { BR: 2, CN: 2, RU: 2, US: 2 } }
incoming = { perCountry: { CN: 2, RU: 2, US: 2 } }  // BR removed
deepMerge result = { perCountry: { BR: 2, CN: 2, RU: 2, US: 2 } }  // BR still there!
```

### Issue 2: In `load()` method (Line 29)
```javascript
// Deep merge: defaults FIRST, then user overrides
const merged = this.deepMerge(PIPELINE_CONFIG, userConfig);
```

**Problem**: When loading, the user's saved config was merged with `PIPELINE_CONFIG` defaults. The defaults contain `BR` and `CN` as default countries. So even if the user successfully saved without `BR`, when loading the config back, `deepMerge` would add `BR` and `CN` back from the defaults!

**Example**:
```javascript
defaults = { perCountry: { BR: 2, CN: 2 } }
userConfig = { perCountry: { CN: 2, RU: 2, US: 2 } }  // User's saved selection
deepMerge result = { perCountry: { BR: 2, CN: 2, RU: 2, US: 2 } }  // BR added back!
```

### Issue 3: In `pipeline.js` `loadRuntimeConfig()` (Line 420)
```javascript
// Deep merge user config with defaults
const merged = deepMerge(PIPELINE_CONFIG, userConfig);
```

**Problem**: The `pipeline.js` file has its own `loadRuntimeConfig()` function that bypasses `ConfigManager` to avoid circular dependencies in Service Workers. This function was doing the exact same problematic merge as Issue 2!

When `getSearchConfigAsync()` was called during article analysis, it would call this `loadRuntimeConfig()` which would merge defaults with user config, **adding default countries back**.

**Example**:
```javascript
defaults = { perCountry: { BR: 2, CN: 2 } }
userConfig = { perCountry: { AR: 2, BR: 2, US: 2 } }  // User removed CN
deepMerge result = { perCountry: { AR: 2, BR: 2, CN: 2, US: 2 } }  // CN added back!
```

This is why the analysis was searching in countries that the user had removed!

## Evidence from Logs

### Before Fix
```javascript
// Saving - appears correct
perCountry: (3) ['CN', 'RU', 'US']  // Saved correctly
perCountryValues: {CN: 2, RU: 2, US: 2}

// Loading back - BR reappears!
countries: (4) ['BR', 'CN', 'RU', 'US']  // BR came back from defaults!
```

## Solution

Added special handling for `perCountry` in both `save()` and `load()` methods to **replace entirely** instead of merging:

### Fix 1: In `save()` method (Lines 63-77)
```javascript
// CRITICAL FIX: For perCountry, replace entirely (don't merge) to allow country removal
// deepMerge only adds/updates keys, it never removes them
if (config.articleSelection?.perCountry !== undefined) {
  if (!mergedUserConfig.articleSelection) {
    mergedUserConfig.articleSelection = {};
  }
  mergedUserConfig.articleSelection.perCountry = { ...config.articleSelection.perCountry };

  console.log('[ConfigManager] perCountry replaced (not merged) to allow country removal', {
    existing: Object.keys(existingUserConfig.articleSelection?.perCountry || {}),
    incoming: Object.keys(config.articleSelection.perCountry),
    result: Object.keys(mergedUserConfig.articleSelection.perCountry)
  });
}
```

### Fix 2: In `ConfigManager.load()` method (Lines 31-42)
```javascript
// CRITICAL FIX: Replace perCountry entirely from userConfig (don't merge with defaults)
// deepMerge would add default countries back, preventing country removal
if (userConfig.articleSelection?.perCountry !== undefined) {
  merged.articleSelection.perCountry = { ...userConfig.articleSelection.perCountry };

  console.log('[ConfigManager] perCountry replaced from userConfig (not merged with defaults)', {
    defaultCountries: Object.keys(PIPELINE_CONFIG.articleSelection?.perCountry || {}),
    userCountries: Object.keys(userConfig.articleSelection.perCountry),
    finalCountries: Object.keys(merged.articleSelection.perCountry)
  });
}
```

### Fix 3: In `pipeline.js` `loadRuntimeConfig()` method (Lines 422-433)
```javascript
// CRITICAL FIX: Replace perCountry entirely from userConfig (don't merge with defaults)
// deepMerge would add default countries back, preventing country removal
// Same fix as in ConfigManager.load()
if (userConfig.articleSelection?.perCountry !== undefined) {
  merged.articleSelection.perCountry = { ...userConfig.articleSelection.perCountry };

  console.log('[Pipeline] perCountry replaced from userConfig (not merged with defaults)', {
    defaultCountries: Object.keys(PIPELINE_CONFIG.articleSelection?.perCountry || {}),
    userCountries: Object.keys(userConfig.articleSelection.perCountry),
    finalCountries: Object.keys(merged.articleSelection.perCountry)
  });
}
```

## Why This Approach Works

1. **Save**: When saving, we completely replace `perCountry` with the incoming value. This allows removing countries because we're not merging keys.

2. **Load (ConfigManager)**: When loading in ConfigManager, we completely replace `perCountry` from userConfig, ignoring defaults. This prevents default countries from being added back.

3. **Load (pipeline.js)**: When loading in pipeline.js (used by background service), we apply the same fix to prevent defaults from being merged.

4. **First-time users**: If `userConfig.articleSelection.perCountry` is `undefined` (first-time user), the normal deepMerge runs and they get the default countries.

5. **Other fields**: All other config fields still benefit from deepMerge behavior (partial updates, inheriting defaults for new fields).

## Testing

### Test Case 1: Remove a default country
1. Open options page
2. Open "Manage countries" modal
3. Uncheck "Brazil" (which is in defaults)
4. Click "Apply" then "Save Settings"
5. Reload extension
6. Open options page again
7. **Expected**: Brazil should NOT appear in selected countries
8. **Actual**: ✅ Brazil is correctly removed

### Test Case 2: Remove all default countries and add custom ones
1. Open options page
2. Remove BR and CN (defaults)
3. Add only RU, US, JP
4. Save and reload
5. **Expected**: Only RU, US, JP should appear
6. **Actual**: ✅ Only custom selection persists

### Test Case 3: First-time user experience
1. Clear extension data
2. Open options page
3. **Expected**: Should see default countries (BR, CN)
4. **Actual**: ✅ Defaults appear correctly

## Related Fixes

This fix also ensures that:
- `bufferPerCountry` value persists correctly (was already working, but now with better logging)
- Other `articleSelection` fields persist correctly
- Configuration changes are properly broadcast to all extension contexts

## Files Modified

1. **`config/configManager.js`**:
   - Lines 63-77: Added perCountry replacement in `save()`
   - Lines 31-42: Added perCountry replacement in `load()`
   - Lines 148-186: Enhanced logging to debug save/load flow

## Design Pattern Used

This fix introduces a pattern for handling **user selection objects** where keys represent user choices (like selected countries). For such objects:

- **Use replacement** instead of merge to allow removal
- **Check for `undefined`** to distinguish "no user preference" from "empty selection"
- **Log the replacement** for debugging future issues

This pattern should be applied to similar configuration fields in the future, such as:
- Selected models in `preferredModels` (already an array, works correctly)
- Any future "selected items" configuration

## Migration Notes

No migration needed. This fix is backward compatible:
- Existing saved configs will load correctly with the new logic
- Users who had the bug will see their intended selection after this fix
- First-time users still get sensible defaults

## Performance Impact

Negligible - only adds one conditional check and object spread operation in `save()` and `load()` methods.
