# Configuration Persistence Fix

## Problem Summary

After reloading the application, some configuration settings were not persisting correctly. This was caused by several issues in the configuration management system.

## Root Causes Identified

### 1. Overly Strict Validation
**Location**: `config/configManager.js:70-77`

**Issue**: The validation logic was rejecting valid configurations:
- Required at least one country to be selected, even during temporary states
- Didn't validate nested structure existence before accessing properties
- Missing validation for critical fields like `preferredModels` array

**Fix**: Enhanced validation to:
- Allow empty `perCountry` with a warning (user can temporarily have no countries)
- Validate structure existence before accessing nested properties
- Add comprehensive validation for `modelProvider`, `preferredModels`, `bufferPerCountry`
- Use proper type checks for numbers and arrays

### 2. Storage Listener Broadcasting User Config Instead of Merged Config
**Location**: `config/configManager.js:276-285`

**Issue**: The `chrome.storage.onChanged` listener was broadcasting the raw user config (without defaults) to all contexts. This caused:
- Missing `availableCountries` array (always loaded from defaults)
- Incomplete configuration objects in background service
- Inconsistent state across extension contexts

**Fix**:
- Merge user config with `PIPELINE_CONFIG` defaults before broadcasting
- Ensure all contexts receive complete, valid configuration
- Add detailed logging of what's being broadcast

### 3. Background Service Config Cache Race Condition
**Location**: `scripts/background.js:120-140`

**Issue**: When receiving `CONFIG_UPDATED` messages:
- The cache reload was async but didn't wait for completion
- No response sent back to confirm cache was updated
- Potential race condition where next operation used stale cache

**Fix**:
- Made the listener async and return `true` to keep channel open
- Wait for `reloadConfigCache()` to complete before responding
- Send success/failure response back to caller
- Add detailed logging of cache reload process

### 4. Missing Verification and Logging
**Location**: `ui/pages/options/options.js`, `ui/pages/options/settings-modal.js`

**Issue**: Save operations didn't verify that settings were actually persisted:
- No logging of what was being saved
- No verification check after save
- Hard to debug configuration issues

**Fix**:
- Add comprehensive logging before save (what's being saved)
- Add verification check after save (reload and compare)
- Log full configuration structure for debugging
- Add API key validation before saving API model selection

## Configuration Flow (Fixed)

### Save Flow
```
User clicks "Save"
    ↓
options.js/settings-modal.js: gatherConfig()
    ↓
ConfigManager.save(partialConfig)
    ↓
1. Load existing userConfig from storage
2. Merge with new partial config (supports incremental updates)
3. Merge with PIPELINE_CONFIG defaults (for validation)
4. Validate merged config (comprehensive checks)
5. Save userConfig to chrome.storage.sync
6. Broadcast MERGED config to all contexts
    ↓
background.js: Receives CONFIG_UPDATED
    ↓
reloadConfigCache() - Loads and merges with defaults
    ↓
Responds with success
    ↓
options.js: Reloads and verifies config
```

### Load Flow
```
Any context needs config
    ↓
ConfigManager.load()
    ↓
1. Load userConfig from chrome.storage.sync
2. Merge with PIPELINE_CONFIG defaults (deep merge)
3. Restore static data (availableCountries)
4. Return complete configuration
```

## New Validation Rules

### Article Selection
- `perCountry`: Must be an object (can be empty with warning)
- `bufferPerCountry`: Must be non-negative number
- `maxForAnalysis`: Must be >= 1

### Analysis Configuration
- `modelProvider`: Must be 'nano' or 'api'
- `preferredModels`: Must be array with at least one model
- API key required when `modelProvider` is 'api'

### Structure Validation
- All required top-level keys must exist (articleSelection, analysis, extraction)
- Nested properties checked for existence before access
- Type validation for all critical fields

## Logging Improvements

### ConfigManager Logs
```javascript
// What's being saved
console.log('[ConfigManager] Saved configuration structure:', {
  articleSelection: { perCountry, bufferPerCountry, maxForAnalysis },
  analysis: { modelProvider, preferredModels, compressionLevel },
  extraction: 'present'
});

// Notification sent
console.log('[ConfigManager] Config change notification sent to all contexts');

// Storage listener
console.log('[ConfigManager] Broadcasting merged config to all contexts', {
  modelProvider, countries, hasAvailableCountries
});
```

### Options Page Logs
```javascript
// Before save
console.log('[Options] Saving configuration', { ... });

// After save
console.log('[Options] ConfigManager.save() completed successfully');
console.log('[Options] Configuration reloaded from storage');

// Verification
console.log('[Options] Verification check:', {
  modelProvider, countries, bufferPerCountry, maxForAnalysis, preferredModels
});
```

### Background Service Logs
```javascript
// Config update received
logger.system.info('Configuration updated, reloading cache immediately');

// Cache reloaded
logger.system.info('Configuration cache updated successfully', {
  modelProvider, countries, preferredModels
});
```

## Testing Checklist

To verify the fix works:

1. **Save Basic Settings**
   - [ ] Change model provider
   - [ ] Change buffer per country
   - [ ] Change max for analysis
   - [ ] Reload extension
   - [ ] Verify settings persisted

2. **Save Country Selection**
   - [ ] Add/remove countries
   - [ ] Change article counts per country
   - [ ] Reload extension
   - [ ] Verify country list persisted

3. **Save Model Configuration**
   - [ ] Change preferred models order
   - [ ] Enable/disable fallback models
   - [ ] Change temperature/topK values
   - [ ] Reload extension
   - [ ] Verify model settings persisted

4. **Cross-Context Verification**
   - [ ] Save settings in options page
   - [ ] Check popup shows updated settings
   - [ ] Trigger analysis (background should use new settings)
   - [ ] Check console logs in all contexts

5. **Edge Cases**
   - [ ] Save with empty countries list
   - [ ] Save with only one country
   - [ ] Save with API model but no API key (should warn)
   - [ ] Reset to defaults and verify

## Debugging Tips

### Check Storage Directly
```javascript
// In any extension context console
chrome.storage.sync.get('perspectiveLens_config', (result) => {
  console.log('Stored user config:', result.perspectiveLens_config);
});
```

### Check Merged Config
```javascript
// In background console
const config = await ConfigManager.load();
console.log('Merged config:', config);
```

### Check Background Cache
```javascript
// In background console (requires configCache to be exposed for debugging)
console.log('Background config cache:', configCache);
```

### Watch Storage Changes
```javascript
// In any extension context console
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.perspectiveLens_config) {
    console.log('Config changed:', {
      old: changes.perspectiveLens_config.oldValue,
      new: changes.perspectiveLens_config.newValue
    });
  }
});
```

## Files Modified

1. **config/configManager.js**
   - Enhanced validation logic
   - Improved save logging
   - Fixed storage listener to broadcast merged config

2. **scripts/background.js**
   - Fixed CONFIG_UPDATED listener to wait for cache reload
   - Added response mechanism
   - Enhanced cache reload logging

3. **ui/pages/options/options.js**
   - Added pre-save logging
   - Added post-save verification
   - Fixed API key validation check

4. **ui/pages/options/settings-modal.js**
   - Added save operation logging
   - Added verification check

## Migration Notes

### For Existing Users
No migration needed. The fix is backward compatible:
- Existing saved configs will load correctly
- Old validation issues won't block valid configs
- Enhanced logging helps debug any edge cases

### For Developers
When adding new configuration fields:
1. Add default value to `config/pipeline.js` in `PIPELINE_CONFIG`
2. Add validation in `ConfigManager.save()` if field is critical
3. Add UI controls in options page
4. Test save/load/reload cycle
5. Check logs in all contexts to verify propagation

## Performance Impact

Minimal performance impact:
- Storage listener now does one merge operation before broadcast
- Background cache reload is now synchronous with response
- Additional logging only in debug/development scenarios
- No impact on analysis pipeline performance

## Related Documentation

- [Configuration System Architecture](../CLAUDE.md#configuration-management-requirements)
- [Pipeline Configuration Reference](../config/pipeline.js)
- [API Key Management](../config/apiKeyManager.js)
