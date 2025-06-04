const Docker = require('dockerode');

const docker = new Docker();

async function getRunningContainers() {
    const containers = await docker.listContainers();
    console.log(containers.map(container => ({
        id: container.Id,
        name: container.Names[0],
        image: container.Image,
        status: container.Status
    })));
}

getRunningContainers();