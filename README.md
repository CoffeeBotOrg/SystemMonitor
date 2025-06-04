# Docker System Monitor

A simple Docker container monitoring tool that tracks CPU and memory usage of running containers.

## Quick Start

### On Windows (Docker Desktop)
```bash
docker build -t docker-system-monitor . && docker run -v //var/run/docker.sock:/var/run/docker.sock docker-system-monitor
```

### On Linux/macOS
```bash
docker build -t docker-system-monitor . && docker run -v /var/run/docker.sock:/var/run/docker.sock docker-system-monitor
```

## Individual Commands
If you prefer to run the commands separately:

### Building the Image
```bash
docker build -t docker-system-monitor .
```

### Running the Container
```bash
# Windows (Docker Desktop)
docker run -v //var/run/docker.sock:/var/run/docker.sock docker-system-monitor

# Linux/macOS
docker run -v /var/run/docker.sock:/var/run/docker.sock docker-system-monitor
```

## Features

- Lists all running containers
- Displays CPU usage percentage
- Shows memory usage in MB
- Updates every 3 seconds
- Alerts on high resource usage (CPU > 0%, Memory > 85%)

## Requirements

- Docker
- Docker socket access 