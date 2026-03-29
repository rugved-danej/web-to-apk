import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

let inquirer, chalk;
try {
  inquirer = (await import('inquirer')).default;
  chalk = (await import('chalk')).default;
} catch (e) {
  execSync('pnpm add -D inquirer chalk', { stdio: 'inherit' });
  inquirer = (await import('inquirer')).default;
  chalk = (await import('chalk')).default;
}

const rootDir = process.cwd();
const capConfigPath = path.join(rootDir, 'capacitor.config.json');
const stringsXmlPath = path.join(rootDir, 'android/app/src/main/res/values/strings.xml');
const manifestPath = path.join(rootDir, 'android/app/src/main/AndroidManifest.xml');
const buildGradlePath = path.join(rootDir, 'android/app/build.gradle');
const assetsDir = path.join(rootDir, 'assets');
const assetsIconPath = path.join(assetsDir, 'icon.png');
const assetsSplashPath = path.join(assetsDir, 'splash.png');

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

  let capConfig = {};
  if (fs.existsSync(capConfigPath)) {
    capConfig = JSON.parse(fs.readFileSync(capConfigPath, 'utf-8'));
  }

  let existingPermissions = [];
  if (fs.existsSync(manifestPath)) {
    const manifestXml = fs.readFileSync(manifestPath, 'utf-8');
    const matches = [...manifestXml.matchAll(/<uses-permission android:name="(.*?)"\s*\/>/g)];
    existingPermissions = matches.map(m => m[1]);
  }

  let currentVersionCode = '1';
  let currentVersionName = '1.0';
  if (fs.existsSync(buildGradlePath)) {
    const bg = fs.readFileSync(buildGradlePath, 'utf-8');
    const vcMatch = bg.match(/versionCode\s+(\d+)/);
    const vnMatch = bg.match(/versionName\s+["'](.*?)["']/);
    if (vcMatch) currentVersionCode = vcMatch[1];
    if (vnMatch) currentVersionName = vnMatch[1];
  }

  const permissionChoices = ALL_PERMISSIONS.map(perm => ({
    name: perm.replace('android.permission.', ''),
    value: perm,
    checked: existingPermissions.includes(perm)
  }));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'appName',
      message: 'What is the name of your app?',
      default: capConfig.appName || 'My App'
    },
    {
      type: 'input',
      name: 'appId',
      message: 'What is the App ID (Package Name)?',
      default: capConfig.appId || 'com.example.app',
      validate: (input) => /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+[0-9a-z_]$/i.test(input) || 'Invalid App ID format (e.g., com.example.app)'
    },
    {
      type: 'input',
      name: 'versionName',
      message: 'What is the App Version Name?',
      default: currentVersionName
    },
    {
      type: 'input',
      name: 'versionCode',
      message: 'What is the App Version Code (Integer)?',
      default: currentVersionCode,
      validate: (input) => /^\d+$/.test(input) || 'Must be an integer'
    },
    {
      type: 'checkbox',
      name: 'permissions',
      message: 'Select the Android permissions your app needs (Space to toggle):',
      choices: permissionChoices,
      loop: false
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
      message: 'Enter path to new icon (.png):',
      when: (answers) => answers.changeLogo,
      validate: (input) => fs.existsSync(path.resolve(input)) && input.toLowerCase().endsWith('.png') ? true : 'Valid .png file required'
    },
    {
      type: 'confirm',
      name: 'changeSplash',
      message: 'Do you want to change the app splash screen?',
      default: false
    },
    {
      type: 'input',
      name: 'splashPath',
      message: 'Enter path to new splash screen (.png):',
      when: (answers) => answers.changeSplash,
      validate: (input) => fs.existsSync(path.resolve(input)) && input.toLowerCase().endsWith('.png') ? true : 'Valid .png file required'
    }
  ]);

  console.log(chalk.blue('\nApplying your configurations...'));

  const oldAppId = capConfig.appId || 'com.example.app';
  
  // Update capacitor config properties
  capConfig.appName = answers.appName;
  capConfig.appId = answers.appId;
  
  // DISABLE CAPACITOR'S DEFAULT EXIT-ON-BACK-BUTTON BEHAVIOR
  if (!capConfig.plugins) capConfig.plugins = {};
  if (!capConfig.plugins.App) capConfig.plugins.App = {};
  capConfig.plugins.App.disableBackButtonHandler = true;
  
  fs.writeFileSync(capConfigPath, JSON.stringify(capConfig, null, 2) + '\n');
  console.log(chalk.green('✔ Updated capacitor.config.json (Back Button Handler setup)'));
  
  if (fs.existsSync(stringsXmlPath)) {
    let stringsXml = fs.readFileSync(stringsXmlPath, 'utf-8');
    stringsXml = stringsXml.replace(/(<string name="app_name">)(.*?)(<\/string>)/, `$1${answers.appName}$3`);
    stringsXml = stringsXml.replace(/(<string name="title_activity_main">)(.*?)(<\/string>)/, `$1${answers.appName}$3`);
    stringsXml = stringsXml.replace(/(<string name="package_name">)(.*?)(<\/string>)/, `$1${answers.appId}$3`);
    stringsXml = stringsXml.replace(/(<string name="custom_url_scheme">)(.*?)(<\/string>)/, `$1${answers.appId}$3`);
    fs.writeFileSync(stringsXmlPath, stringsXml);
    console.log(chalk.green('✔ Updated strings.xml'));
  }

  if (fs.existsSync(manifestPath)) {
    let manifestXml = fs.readFileSync(manifestPath, 'utf-8');
    manifestXml = manifestXml.replace(/(\s*<uses-permission android:name=".*?"\s*\/>\n?)+/g, '\n');
    const permissionTags = answers.permissions.map(perm => `    <uses-permission android:name="${perm}" />`).join('\n');
    manifestXml = manifestXml.replace('</manifest>', `\n${permissionTags}\n</manifest>`);
    fs.writeFileSync(manifestPath, manifestXml);
    console.log(chalk.green('✔ Updated AndroidManifest.xml'));
  }

  if (fs.existsSync(buildGradlePath)) {
    let bg = fs.readFileSync(buildGradlePath, 'utf-8');
    bg = bg.replace(/namespace\s*=\s*["'].*?["']/, `namespace = "${answers.appId}"`);
    bg = bg.replace(/applicationId\s+["'].*?["']/, `applicationId "${answers.appId}"`);
    bg = bg.replace(/versionCode\s+\d+/, `versionCode ${answers.versionCode}`);
    bg = bg.replace(/versionName\s+["'].*?["']/, `versionName "${answers.versionName}"`);
    fs.writeFileSync(buildGradlePath, bg);
    console.log(chalk.green('✔ Updated build.gradle'));
  }

  // Handle App ID folder rename
  if (oldAppId !== answers.appId) {
    const oldPath = path.join(rootDir, 'android/app/src/main/java', ...oldAppId.split('.'));
    const newPath = path.join(rootDir, 'android/app/src/main/java', ...answers.appId.split('.'));
    const oldFile = path.join(oldPath, 'MainActivity.java');
    const newFile = path.join(newPath, 'MainActivity.java');

    if (!fs.existsSync(newPath)) fs.mkdirSync(newPath, { recursive: true });

    if (fs.existsSync(oldFile)) {
      let javaContent = fs.readFileSync(oldFile, 'utf-8');
      javaContent = javaContent.replace(/^package\s+.*?;/m, `package ${answers.appId};`);
      fs.writeFileSync(newFile, javaContent);
      fs.unlinkSync(oldFile);
      
      let currentDir = oldPath;
      while (currentDir !== path.join(rootDir, 'android/app/src/main/java')) {
        try {
          if (fs.readdirSync(currentDir).length === 0) fs.rmdirSync(currentDir);
          currentDir = path.dirname(currentDir);
        } catch (e) {
          break;
        }
      }
    }
  }

  // --- NATIVE SWIPE-TO-GO-BACK HANDLING ---
  // Inject the native webview history logic into MainActivity.java
  const currentAppIdPath = path.join(rootDir, 'android/app/src/main/java', ...answers.appId.split('.'));
  const mainActivityPath = path.join(currentAppIdPath, 'MainActivity.java');

  if (fs.existsSync(mainActivityPath)) {
    let javaContent = fs.readFileSync(mainActivityPath, 'utf-8');
    
    // Add WebView import if it isn't there
    if (!javaContent.includes('import android.webkit.WebView;')) {
        javaContent = javaContent.replace(
            'import com.getcapacitor.BridgeActivity;',
            'import com.getcapacitor.BridgeActivity;\nimport android.webkit.WebView;'
        );
    }

    // Override the Android Back Button behavior 
    if (!javaContent.includes('public void onBackPressed()')) {
        javaContent = javaContent.replace(
            /public class MainActivity extends BridgeActivity\s*\{\s*\}/,
            `public class MainActivity extends BridgeActivity {
    @Override
    public void onBackPressed() {
        WebView webView = this.bridge.getWebView();
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}`
        );
    }
    fs.writeFileSync(mainActivityPath, javaContent);
    console.log(chalk.green('✔ Injected native Swipe-to-Go-Back handling in MainActivity.java'));
  }

  let runAssetsGen = false;

  if (answers.changeLogo) {
    if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir);
    fs.copyFileSync(path.resolve(answers.logoPath), assetsIconPath);
    runAssetsGen = true;
  }

  if (answers.changeSplash) {
    if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir);
    fs.copyFileSync(path.resolve(answers.splashPath), assetsSplashPath);
    runAssetsGen = true;
  }

  if (runAssetsGen) {
    try {
      execSync('pnpm dlx --allow-build=sharp @capacitor/assets generate --android', { stdio: 'inherit' });
    } catch (err) {
      console.error(chalk.red('✖ Failed to generate Android icons/splashes.'), err.message);
    }
  }

  console.log(chalk.cyan.bold('\n✨ All done! Your app is fully configured.\n'));
}

run().catch(err => {
  console.error('An unexpected error occurred:', err);
});

