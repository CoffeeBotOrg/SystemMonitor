import Docker from 'dockerode';

// Alert thresholds
const THRESHOLDS = {
    CPU_PERCENT: 0,    // Alert if CPU usage is above 80%
    MEMORY_PERCENT: 85  // Alert if memory usage is above 85%
};

// ANSI color codes for console output
const COLORS = {
    RED: '\x1b[31m',
    YELLOW: '\x1b[33m',
    GREEN: '\x1b[32m',
    RESET: '\x1b[0m'
};

const docker = new Docker();
const wait = async (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getRunningContainers() {
    try {
        const containers = await docker.listContainers();
        return containers.map(container => ({
            id: container.Id,
            name: container.Names[0],
            image: container.Image,
            status: container.Status
        }));
    } catch (error) {
        console.error('Error getting container list:', error);
        return [];
    }
}

async function handleError(error) {
    console.error('Error:', error.message);
}

function formatBytes(bytes) {
    const mb = bytes / (1024 * 1024);
    return mb.toFixed(2);
}

async function getStats(containerId) {
    try {
        const container = docker.getContainer(containerId);
        const stats = await container.stats({ stream: false });

        const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
        const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
        const numberOfCores = stats.cpu_stats.online_cpus;
        const cpuPercent = (cpuDelta / systemDelta) * numberOfCores * 100;

        // Calculate memory percentage
        const memoryUsage = stats.memory_stats.usage;
        const memoryLimit = stats.memory_stats.limit;
        const memoryPercent = (memoryUsage / memoryLimit) * 100;

        // Get container name
        const containerInfo = await container.inspect();
        const containerName = containerInfo.Name.replace('/', '');

        // Determine status colors and create alerts
        const cpuColor = cpuPercent > THRESHOLDS.CPU_PERCENT ? COLORS.RED : COLORS.GREEN;
        const memColor = memoryPercent > THRESHOLDS.MEMORY_PERCENT ? COLORS.RED : COLORS.GREEN;

        console.log(`\nContainer: ${COLORS.YELLOW}${containerName}${COLORS.RESET}`);
        console.log(`CPU Usage: ${cpuColor}${cpuPercent.toFixed(2)}%${COLORS.RESET}`);
        console.log(`Memory Usage: ${memColor}${formatBytes(memoryUsage)} MB (${memoryPercent.toFixed(2)}%)${COLORS.RESET}`);

        // Alert on high resource usage
        if (cpuPercent > THRESHOLDS.CPU_PERCENT) {
            console.log(`${COLORS.RED}⚠ ALERT: High CPU usage detected for ${containerName}!${COLORS.RESET}`);
        }
        if (memoryPercent > THRESHOLDS.MEMORY_PERCENT) {
            console.log(`${COLORS.RED}⚠ ALERT: High memory usage detected for ${containerName}!${COLORS.RESET}`);
        }
    } catch (error) {
        handleError(error);
    }
}

async function main() {
    try {
        console.log(`${COLORS.YELLOW}Monitor started with thresholds:${COLORS.RESET}`);
        console.log(`CPU Alert Threshold: ${THRESHOLDS.CPU_PERCENT}%`);
        console.log(`Memory Alert Threshold: ${THRESHOLDS.MEMORY_PERCENT}%\n`);

        while (true) {
            console.clear(); // Clear console for better readability
            const containers = await getRunningContainers();
            for (const container of containers) {
                await getStats(container.id);
            }
            console.log(`\n${COLORS.YELLOW}Waiting for 3 seconds...${COLORS.RESET}`);
            await wait(3000);
        }
    } catch (error) {
        console.error('Fatal error in main loop:', error);
        process.exit(1);
    }
}

main().catch(error => {
    console.error('Application crashed:', error);
    process.exit(1);
});
