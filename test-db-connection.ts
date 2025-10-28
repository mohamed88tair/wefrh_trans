/**
 * Database Connection Test Script
 * Tests the connection to Supabase PostgreSQL database
 */

import { storage } from "./server/storage-database";

async function testConnection() {
  console.log("🔍 Testing database connection...\n");

  try {
    // Test 1: Get all AI models
    console.log("1. Testing AI Models retrieval...");
    const models = await storage.getAllAiModels();
    console.log(`✅ Found ${models.length} AI models in database`);
    console.log(`   Sample models: ${models.slice(0, 3).map(m => m.name).join(', ')}\n`);

    // Test 2: Get global settings
    console.log("2. Testing Global Settings retrieval...");
    const settings = await storage.getAllGlobalSettings();
    console.log(`✅ Found ${settings.length} global settings`);
    settings.forEach(s => {
      console.log(`   - ${s.settingKey}: ${s.settingValue}`);
    });
    console.log();

    // Test 3: Get all projects
    console.log("3. Testing Projects retrieval...");
    const projects = await storage.getAllProjects();
    console.log(`✅ Found ${projects.length} translation projects\n`);

    // Test 4: Create a test project
    console.log("4. Testing Project creation...");
    const testProject = await storage.createProject({
      name: "Test Translation Project",
      fileName: "test.json",
      fileType: "json",
      fileSize: 1024,
      totalItems: 10,
      translatedItems: 0,
      progressPercentage: 0
    });
    console.log(`✅ Created test project with ID: ${testProject.id}\n`);

    // Test 5: Create test translation items
    console.log("5. Testing Translation Items creation...");
    const testItem = await storage.createTranslationItem({
      projectId: testProject.id,
      key: "test.key",
      originalText: "Hello World",
      translatedText: null,
      status: "untranslated",
      selected: false
    });
    console.log(`✅ Created test item with ID: ${testItem.id}\n`);

    // Test 6: Update item
    console.log("6. Testing Translation Item update...");
    await storage.updateTranslationItem(testItem.id, {
      translatedText: "مرحبا بالعالم",
      status: "translated"
    });
    console.log(`✅ Updated translation item\n`);

    // Test 7: Update project progress
    console.log("7. Testing Project progress update...");
    await storage.updateProjectProgress(testProject.id);
    const updatedProject = await storage.getProject(testProject.id);
    console.log(`✅ Project progress: ${updatedProject?.progressPercentage}%\n`);

    // Test 8: Get project items
    console.log("8. Testing Project items retrieval...");
    const items = await storage.getProjectItems(testProject.id);
    console.log(`✅ Found ${items.length} items in project\n`);

    // Cleanup
    console.log("9. Cleaning up test data...");
    await storage.deleteProject(testProject.id);
    console.log(`✅ Deleted test project\n`);

    console.log("🎉 All database tests passed successfully!");
    console.log("\n📊 Database Summary:");
    console.log(`   - ${models.length} AI models available`);
    console.log(`   - ${settings.length} global settings configured`);
    console.log(`   - Database connection: ✅ Working`);
    console.log(`   - CRUD operations: ✅ Working`);

  } catch (error) {
    console.error("❌ Database test failed:", error);
    process.exit(1);
  }

  process.exit(0);
}

testConnection();
