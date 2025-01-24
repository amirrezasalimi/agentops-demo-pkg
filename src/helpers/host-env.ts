import logger from './logger';

const isBrowser = typeof window !== 'undefined';

export async function getHostEnvData() {
  if (isBrowser) {
    logger.debug(
      'Running in a browser. Cannot access system information or package.json directly.'
    );

    return {};
  } else {
    try {
      const os = await import('os');
      const process = await import('process');
      const systeminformation = await import('systeminformation');
      const fs = await import('fs/promises');
      const path = await import('path');

      // Get OS information
      const osInfo = {
        OS: os.default.type(),
        OS_Release: os.default.release(),
        OS_Version: os.default.version(),
      };

      // Get CPU information
      const cpuUsage = await systeminformation.default.currentLoad();
      const cpuInfo = {
        CPU_Usage: `${cpuUsage.currentLoad.toFixed(1)}%`,
        Total_cores: os.default.cpus().length,
      };

      // Get RAM information
      const ramInfo = {
        Used: `${(os.default.totalmem() - os.default.freemem()) / 1024 / 1024 / 1024} GB`,
        Total: `${os.default.totalmem() / 1024 / 1024 / 1024} GB`,
      };

      // Get installed packages from package.json
      const packageJsonPath = path.default.resolve(
        process.default.cwd(),
        'package.json'
      ); // Resolve path to package.json
      const packageJsonContent = await fs.default.readFile(
        packageJsonPath,
        'utf-8'
      ); // Read package.json
      const packageJson = JSON.parse(packageJsonContent); // Parse package.json
      const installedPackages = packageJson.dependencies || {}; // Get dependencies
      const devDependencies = packageJson.devDependencies || {}; // Get devDependencies

      // Get SDK/Python information (example)
      const sdkInfo = {
        Python_Version: process.default.env.PYTHON_VERSION || 'Not available', // Example: Set PYTHON_VERSION in environment variables
        System_Packages: {
          ...installedPackages, // Include dependencies
          ...devDependencies, // Include devDependencies
        },
      };

      // Return the combined data
      return {
        host_env: {
          OS: osInfo,
          CPU: cpuInfo,
          RAM: ramInfo,
          SDK: sdkInfo,
        },
      };
    } catch (error) {
      logger.debug(
        'Error retrieving system information or package.json:',
        error
      );
      return null;
    }
  }
}
