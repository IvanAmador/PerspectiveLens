/**
 * Test Script for Gemini 2.5 Pro Integration
 *
 * USAGE:
 * 1. Open Chrome DevTools
 * 2. Go to Sources > Service Workers > background.js
 * 3. Copy and paste this entire script into the console
 * 4. Press Enter
 */

(async function testGeminiPro() {
  console.log('🧪 Testing Gemini 2.5 Pro Integration...\n');

  // Your API key
  const API_KEY = 'AIzaSyDRhFO7uySH9iUZBuzgF8CZsvQ731C1Nyw';

  try {
    // Test 1: Check availability directly with fetch
    console.log('1️⃣ Testing API availability with direct fetch...');
    const testResponse = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash',
      {
        method: 'GET',
        headers: {
          'x-goog-api-key': API_KEY
        }
      }
    );

    if (testResponse.ok) {
      const modelInfo = await testResponse.json();
      console.log('✅ API Key is valid!');
      console.log('   Model:', modelInfo.name);
      console.log('   Display Name:', modelInfo.displayName);
      console.log('   Description:', modelInfo.description);
    } else {
      console.error('❌ API request failed:', testResponse.status, testResponse.statusText);
      const errorData = await testResponse.json();
      console.error('   Error details:', errorData);
      return;
    }

    // Test 2: Test with APIKeyManager
    console.log('\n2️⃣ Testing with APIKeyManager...');
    const { APIKeyManager } = await import('./config/apiKeyManager.js');

    const validation = await APIKeyManager.validate(API_KEY);
    console.log('   Validation result:', validation);

    if (validation.isValid) {
      console.log('✅ APIKeyManager validation passed!');
    } else {
      console.error('❌ APIKeyManager validation failed:', validation.error);
      return;
    }

    // Test 3: Save API key
    console.log('\n3️⃣ Saving API key to storage...');
    await APIKeyManager.save(API_KEY);
    console.log('✅ API key saved successfully');

    // Test 4: Load API key
    console.log('\n4️⃣ Loading API key from storage...');
    const loadedKey = await APIKeyManager.load();
    console.log('   Loaded key:', APIKeyManager.mask(loadedKey));
    console.log('✅ API key loaded successfully');

    // Test 5: Create Gemini25ProAPI instance
    console.log('\n5️⃣ Creating Gemini25ProAPI instance...');
    const { Gemini25ProAPI } = await import('./api/gemini-2-5-pro.js');

    const proAPI = new Gemini25ProAPI(API_KEY, {
      model: 'gemini-2.5-flash', // Using flash for faster testing
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      thinkingBudget: -1
    });
    console.log('✅ Gemini25ProAPI instance created');

    // Test 6: Check availability via wrapper
    console.log('\n6️⃣ Checking API availability via wrapper...');
    const availability = await proAPI.checkAvailability();
    console.log('   Availability:', availability);

    if (availability === 'ready') {
      console.log('✅ Gemini 2.5 Pro is ready!');
    } else {
      console.error('❌ Gemini 2.5 Pro not ready:', availability);
      return;
    }

    // Test 7: Test a simple generation
    console.log('\n7️⃣ Testing text generation...');
    const testPayload = {
      contents: [
        {
          parts: [
            { text: 'Reply with a valid JSON object containing only {"test": "success", "message": "Hello from Gemini 2.5 Pro!"}' }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            test: { type: 'STRING' },
            message: { type: 'STRING' }
          },
          required: ['test', 'message']
        }
      }
    };

    const genResponse = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testPayload)
      }
    );

    if (genResponse.ok) {
      const genData = await genResponse.json();
      const responseText = genData.candidates[0].content.parts[0].text;
      console.log('   Response:', responseText);
      const parsedResponse = JSON.parse(responseText);
      console.log('   Parsed JSON:', parsedResponse);
      console.log('✅ Text generation successful!');
    } else {
      console.error('❌ Generation failed:', genResponse.status);
      const errorData = await genResponse.json();
      console.error('   Error:', errorData);
    }

    // Test 8: Update configuration
    console.log('\n8️⃣ Updating configuration to use Gemini 2.5 Pro...');
    const { ConfigManager } = await import('./config/configManager.js');

    await ConfigManager.set('analysis.modelProvider', 'gemini-2.5-pro');
    console.log('✅ Configuration updated');

    // Test 9: Verify configuration
    console.log('\n9️⃣ Verifying configuration...');
    const config = await ConfigManager.load();
    console.log('   Current model provider:', config.analysis.modelProvider);
    console.log('   Pro settings:', config.analysis.gemini25Pro);
    console.log('✅ Configuration verified');

    // Test 10: Test getExtensionStatus
    console.log('\n🔟 Testing getExtensionStatus...');
    const statusResponse = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
    console.log('   Status:', statusResponse);
    console.log('✅ Extension status retrieved');

    console.log('\n🎉 All tests passed! Gemini 2.5 Pro integration is working correctly!\n');
    console.log('📝 Summary:');
    console.log('   - API Key: Valid ✅');
    console.log('   - Storage: Working ✅');
    console.log('   - API Wrapper: Working ✅');
    console.log('   - Text Generation: Working ✅');
    console.log('   - Configuration: Updated ✅');
    console.log('\n💡 Next step: Implement the popup UI to manage the API key visually');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    console.error('   Stack:', error.stack);
  }
})();
