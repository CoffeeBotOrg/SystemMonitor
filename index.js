import Docker from 'dockerode';
import fetch from 'node-fetch';
import webhooks from './webhooks.json' assert { type: 'json' };

const THRESHOLDS = {
    CPU_PERCENT: 70,
    MEMORY_PERCENT: 0  
};

const COLORS = {
    RED: '\x1b[31m',
    YELLOW: '\x1b[33m',
    GREEN: '\x1b[32m',
    RESET: '\x1b[0m'
};

const alertCooldowns = new Map();
const COOLDOWN_PERIOD = 5 * 60 * 1000; 

const docker = new Docker();
const wait = async (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendWebhookAlert(message, color = 0xFF0000) {
    try {
        const webhookUrls = webhooks.webhooks.map(webhook => Object.values(webhook)[0]);
        
        const embed = {
            title: "Docker Container Alert",
            description: message,
            color: color,
            timestamp: new Date().toISOString()
        };

        const payload = {
            embeds: [embed]
        };
        //send to all webhooks inside webhooks.json
        const promises = webhookUrls.map(url =>
            fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            })
        );

        await Promise.all(promises);
    } catch (error) {
        console.error('Error sending webhook:', error);
    }
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
        await sendWebhookAlert(`🚨 Error getting container list: ${error.message}`, 0xFF0000);
        return [];
    }
}

async function handleError(error) {
    console.error('Error:', error.message);
    await sendWebhookAlert(`🚨 Error: ${error.message}`, 0xFF0000);
}

function formatBytes(bytes) {
    const mb = bytes / (1024 * 1024);
    return mb.toFixed(2);
}

function canSendAlert(containerName, alertType) {
    const key = `${containerName}-${alertType}`;
    const lastAlert = alertCooldowns.get(key);
    const now = Date.now();

    if (!lastAlert || (now - lastAlert) > COOLDOWN_PERIOD) {
        alertCooldowns.set(key, now);
        return true;
    }
    return false;
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

        const cpuColor = cpuPercent > THRESHOLDS.CPU_PERCENT ? COLORS.RED : COLORS.GREEN;
        const memColor = memoryPercent > THRESHOLDS.MEMORY_PERCENT ? COLORS.RED : COLORS.GREEN;

        console.log(`\nContainer: ${COLORS.YELLOW}${containerName}${COLORS.RESET}`);
        console.log(`CPU Usage: ${cpuColor}${cpuPercent.toFixed(2)}%${COLORS.RESET}`);
        console.log(`Memory Usage: ${memColor}${formatBytes(memoryUsage)} MB (${memoryPercent.toFixed(2)}%)${COLORS.RESET}`);

        if (cpuPercent > THRESHOLDS.CPU_PERCENT && canSendAlert(containerName, 'cpu')) {
            const message = `🔥 High CPU Alert!\nContainer: ${containerName}\nCPU Usage: ${cpuPercent.toFixed(2)}%`;
            console.log(`${COLORS.RED}⚠ ALERT: High CPU usage detected for ${containerName}!${COLORS.RESET}`);
            await sendWebhookAlert(message, 0xFFA500);
        }
        if (memoryPercent > THRESHOLDS.MEMORY_PERCENT && canSendAlert(containerName, 'memory')) {
            const message = `💾 High Memory Alert!\nContainer: ${containerName}\nMemory Usage: ${formatBytes(memoryUsage)} MB (${memoryPercent.toFixed(2)}%)`;
            console.log(`${COLORS.RED}⚠ ALERT: High memory usage detected for ${containerName}!${COLORS.RESET}`);
            await sendWebhookAlert(message, 0xFFA500);
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

        await sendWebhookAlert("🚀 Docker Monitor Started", 0x00FF00);

        while (true) {
            const containers = await getRunningContainers();
            for (const container of containers) {
                await getStats(container.id);
            }
            console.log(`\n${COLORS.YELLOW}Waiting for 3 seconds...${COLORS.RESET}`);
            await wait(3000);
        }
    } catch (error) {
        console.error('Fatal error in main loop:', error);
        await sendWebhookAlert(`💀 Fatal Error: ${error.message}`, 0xFF0000);
        process.exit(1);
    }
}

main().catch(async error => {
    console.error('Application crashed:', error);
    await sendWebhookAlert(`💀 Application Crashed: ${error.message}`, 0xFF0000);
    process.exit(1);
});
