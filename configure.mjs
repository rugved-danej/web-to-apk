import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// ==========================================
// 1. AUTO-INSTALL DEPENDENCIES
// ==========================================
let inquirer, chalk;
try {
  // Try to import them. If they fail, it throws an error and goes to catch block.
  inquirer = (await import('inquirer')).default;
  chalk = (await import('chalk')).default;
} catch (e) {
  console.log('📦 Required packages (inquirer, chalk) not found. Installing them automatically via pnpm...');
  execSync('pnpm add -D inquirer chalk', { stdio: 'inherit' });
  
  // Import again after installation
  inquirer = (await import('inquirer')).default;
  chalk = (await import('chalk')).default;
  console.log(chalk.green('✔ Packages installed successfully!\n'));
}

// ==========================================
// 2. CONFIGURATION & SETUP
// ==========================================
const rootDir = process.cwd();
const capConfigPath = path.join(rootDir, 'capacitor.config.json');
const stringsXmlPath = path.join(rootDir, 'android/app/src/main/res/values/strings.xml');
const manifestPath = path.join(rootDir, 'android/app/src/main/AndroidManifest.xml');
const assetsIconPath = path.join(rootDir, 'assets/icon.png');

// Extensive list of Android Permissions
const ALL_PERMISSIONS = [
  'android.permission.INTERNET',
  'android.permission.CAMERA',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.READ_MEDIA_AUDIO',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.RECORD_AUDIO',
  'android.permission.BLUETOOTH',
  'android.permission.BLUETOOTH_ADMIN',
  'android.permission.BLUETOOTH_CONNECT',
  'android.permission.BLUETOOTH_SCAN',
  'android.permission.READ_CONTACTS',
  'android.permission.WRITE_CONTACTS',
  'android.permission.CALL_PHONE',
  'android.permission.READ_PHONE_STATE',
  'android.permission.WAKE_LOCK',
  'android.permission.VIBRATE',
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'android.permission.ACCESS_NETWORK_STATE',
  'android.permission.ACCESS_WIFI_STATE',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.USE_BIOMETRIC'
];

async function run() {
  console.log(chalk.cyan.bold('\n📱 Web-to-APK Advanced Configuration Tool\n'));

  // --- Read existing app name ---
  let capConfig = {};
  if (fs.existsSync(capConfigPath)) {
    capConfig = JSON.parse(fs.readFileSync(capConfigPath, 'utf-8'));
  }

  // --- Read existing permissions ---
  let existingPermissions = [];
  if (fs.existsSync(manifestPath)) {
    const manifestXml = fs.readFileSync(manifestPath, 'utf-8');
    // Extract everything currently in the manifest
    const matches = [...manifestXml.matchAll(/<uses-permission android:name="(.*?)"\s*\/>/g)];
    existingPermissions = matches.map(m => m[1]);
  }

  // Format choices for Inquirer
  const permissionChoices = ALL_PERMISSIONS.map(perm => ({
    name: perm.replace('android.permission.', ''), // Show shorter name in CLI
    value: perm,
    checked: existingPermissions.includes(perm) // Pre-select if already exists
  }));

  // ==========================================
  // 3. USER PROMPTS
  // ==========================================
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'appName',
      message: 'What is the name of your app?',
      default: capConfig.appName || 'My App'
    },
    {
      type: 'checkbox',
      name: 'permissions',
      message: 'Select the Android permissions your app needs (Space to toggle):',
      choices: permissionChoices,
      loop: false // Prevents wrapping around, easier to navigate large lists
    },
    {
      type: 'confirm',
      name: 'changeLogo',
      message: 'Do you want to change the app logo/icon?',
      default: false
    },
    {
      type: 'input',
      name: 'logoPath',
      message: 'Enter the relative or absolute path to your new icon (.png, 1024x1024px recommended):',
      when: (answers) => answers.changeLogo,
      validate: (input) => {
        const resolvedPath = path.resolve(input);
        if (fs.existsSync(resolvedPath)) {
            if(input.toLowerCase().endsWith('.png')) return true;
            return 'The icon must be a .png file.';
        }
        return 'File does not exist. Please enter a valid path.';
      }
    }
  ]);

  console.log(chalk.blue('\nApplying your configurations...'));

  // ==========================================
  // 4. APPLY CHANGES
  // ==========================================

  // --- UPDATE capacitor.config.json ---
  capConfig.appName = answers.appName;
  fs.writeFileSync(capConfigPath, JSON.stringify(capConfig, null, 2) + '\n');
  console.log(chalk.green('✔ Updated capacitor.config.json'));

  // --- UPDATE strings.xml ---
  if (fs.existsSync(stringsXmlPath)) {
    let stringsXml = fs.readFileSync(stringsXmlPath, 'utf-8');
    stringsXml = stringsXml.replace(/(<string name="app_name">)(.*?)(<\/string>)/, `$1${answers.appName}$3`);
    stringsXml = stringsXml.replace(/(<string name="title_activity_main">)(.*?)(<\/string>)/, `$1${answers.appName}$3`);
    fs.writeFileSync(stringsXmlPath, stringsXml);
    console.log(chalk.green('✔ Updated app name in strings.xml'));
  }

  // --- UPDATE AndroidManifest.xml ---
  if (fs.existsSync(manifestPath)) {
    let manifestXml = fs.readFileSync(manifestPath, 'utf-8');
    // Clear out old permissions
    manifestXml = manifestXml.replace(/(\s*<uses-permission android:name=".*?"\s*\/>\n?)+/g, '\n');
    
    // Build new permission tags
    const permissionTags = answers.permissions
      .map(perm => `    <uses-permission android:name="${perm}" />`)
      .join('\n');
    
    // Insert new permissions right before </manifest>
    manifestXml = manifestXml.replace('</manifest>', `\n    \n${permissionTags}\n</manifest>`);
    fs.writeFileSync(manifestPath, manifestXml);
    console.log(chalk.green('✔ Updated Android permissions in AndroidManifest.xml'));
  }

  // --- UPDATE LOGO ---
  if (answers.changeLogo) {
      console.log(chalk.blue('\nProcessing new App Icon...'));
      const sourceIcon = path.resolve(answers.logoPath);
      
      // Overwrite assets/icon.png
      fs.copyFileSync(sourceIcon, assetsIconPath);
      console.log(chalk.green('✔ Copied new icon to assets/icon.png'));

      console.log(chalk.yellow('⚙ Generating Android mipmap icons (this might take a few seconds)...'));
      try {
          // Use the exact command from your build.yml that permits building sharp
          execSync('pnpm dlx --allow-build=sharp @capacitor/assets generate --android', { stdio: 'inherit' });
          console.log(chalk.green('✔ Successfully generated all Android icons!'));
      } catch (err) {
          console.error(chalk.red('✖ Failed to generate Android icons. Details:'), err.message);
      }
  }

  console.log(chalk.cyan.bold('\n✨ All done! Your app is fully configured.\n'));
}

run().catch(err => {
  console.error('An unexpected error occurred:', err);
});

