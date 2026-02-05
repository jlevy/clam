/**
 * Recommended Commands - Curated list of common developer commands.
 *
 * These commands are given higher priority in completion results to surface
 * the most useful options first. Inspired by kash's recommended command list.
 *
 * Categories:
 * - Shell basics: ls, cd, cat, grep, find, etc.
 * - Version control: git, gh
 * - Package managers: npm, pnpm, yarn, bun
 * - Runtimes: node, python, deno, bun
 * - Containers: docker, kubectl, podman
 * - Network: curl, wget, ssh, scp
 * - Editors: vim, nvim, nano, code
 */

/**
 * Command category for grouping and display.
 */
export type CommandCategory =
  | 'shell'
  | 'version-control'
  | 'package-manager'
  | 'runtime'
  | 'container'
  | 'network'
  | 'editor'
  | 'other';

/**
 * Command metadata including category and description.
 */
interface CommandMeta {
  category: CommandCategory;
  description: string;
}

/**
 * Mapping of commands to their metadata (category and description).
 */
const COMMAND_META: Record<string, CommandMeta> = {
  // Shell basics
  ls: { category: 'shell', description: 'List directory contents' },
  cd: { category: 'shell', description: 'Change working directory' },
  cat: { category: 'shell', description: 'Concatenate and print files' },
  grep: { category: 'shell', description: 'Search text using patterns' },
  find: { category: 'shell', description: 'Find files by name or attributes' },
  mkdir: { category: 'shell', description: 'Create directories' },
  rm: { category: 'shell', description: 'Remove files or directories' },
  cp: { category: 'shell', description: 'Copy files and directories' },
  mv: { category: 'shell', description: 'Move or rename files' },
  chmod: { category: 'shell', description: 'Change file permissions' },
  chown: { category: 'shell', description: 'Change file owner and group' },
  pwd: { category: 'shell', description: 'Print working directory' },
  echo: { category: 'shell', description: 'Display text or variables' },
  head: { category: 'shell', description: 'Output first part of files' },
  tail: { category: 'shell', description: 'Output last part of files' },
  less: { category: 'shell', description: 'View file contents with paging' },
  more: { category: 'shell', description: 'View file contents page by page' },
  wc: { category: 'shell', description: 'Count lines, words, characters' },
  sort: { category: 'shell', description: 'Sort lines of text files' },
  uniq: { category: 'shell', description: 'Filter duplicate lines' },
  diff: { category: 'shell', description: 'Compare files line by line' },
  which: { category: 'shell', description: 'Locate a command' },
  whereis: { category: 'shell', description: 'Locate binary, source, manual' },
  man: { category: 'shell', description: 'Display manual pages' },
  history: { category: 'shell', description: 'Display command history' },
  clear: { category: 'shell', description: 'Clear terminal screen' },
  touch: { category: 'shell', description: 'Create empty file or update timestamp' },
  ln: { category: 'shell', description: 'Create links between files' },
  tar: { category: 'shell', description: 'Archive files' },
  gzip: { category: 'shell', description: 'Compress files' },
  gunzip: { category: 'shell', description: 'Decompress files' },
  zip: { category: 'shell', description: 'Package and compress files' },
  unzip: { category: 'shell', description: 'Extract compressed files' },
  xargs: { category: 'shell', description: 'Build commands from input' },
  sed: { category: 'shell', description: 'Stream editor for text' },
  awk: { category: 'shell', description: 'Pattern scanning and processing' },
  ps: { category: 'shell', description: 'Report process status' },
  kill: { category: 'shell', description: 'Terminate processes' },
  top: { category: 'shell', description: 'Display system processes' },
  htop: { category: 'shell', description: 'Interactive process viewer' },
  df: { category: 'shell', description: 'Report filesystem disk usage' },
  du: { category: 'shell', description: 'Estimate file space usage' },
  free: { category: 'shell', description: 'Display memory usage' },
  env: { category: 'shell', description: 'Display or set environment' },
  export: { category: 'shell', description: 'Set environment variables' },
  source: { category: 'shell', description: 'Execute commands from file' },

  // Version control
  git: { category: 'version-control', description: 'Distributed version control system' },
  gh: { category: 'version-control', description: 'GitHub CLI' },
  svn: { category: 'version-control', description: 'Subversion version control' },
  hg: { category: 'version-control', description: 'Mercurial version control' },

  // Package managers
  npm: { category: 'package-manager', description: 'Node.js package manager' },
  npx: { category: 'package-manager', description: 'Execute npm packages' },
  pnpm: { category: 'package-manager', description: 'Fast, disk-efficient package manager' },
  yarn: { category: 'package-manager', description: 'JavaScript package manager' },
  bun: { category: 'package-manager', description: 'Fast JavaScript runtime and toolkit' },
  pip: { category: 'package-manager', description: 'Python package installer' },
  pip3: { category: 'package-manager', description: 'Python 3 package installer' },
  pipx: { category: 'package-manager', description: 'Install Python apps in isolation' },
  uv: { category: 'package-manager', description: 'Fast Python package manager' },
  cargo: { category: 'package-manager', description: 'Rust package manager' },
  brew: { category: 'package-manager', description: 'macOS package manager' },
  apt: { category: 'package-manager', description: 'Debian/Ubuntu package manager' },
  dnf: { category: 'package-manager', description: 'Fedora package manager' },
  yum: { category: 'package-manager', description: 'RPM-based package manager' },
  pacman: { category: 'package-manager', description: 'Arch Linux package manager' },

  // Runtimes
  node: { category: 'runtime', description: 'JavaScript runtime' },
  deno: { category: 'runtime', description: 'Secure JavaScript/TypeScript runtime' },
  python: { category: 'runtime', description: 'Python interpreter' },
  python3: { category: 'runtime', description: 'Python 3 interpreter' },
  ruby: { category: 'runtime', description: 'Ruby interpreter' },
  go: { category: 'runtime', description: 'Go programming language' },
  rustc: { category: 'runtime', description: 'Rust compiler' },
  java: { category: 'runtime', description: 'Java runtime' },
  javac: { category: 'runtime', description: 'Java compiler' },

  // Containers
  docker: { category: 'container', description: 'Container platform' },
  'docker-compose': { category: 'container', description: 'Multi-container Docker apps' },
  podman: { category: 'container', description: 'Daemonless container engine' },
  kubectl: { category: 'container', description: 'Kubernetes CLI' },
  helm: { category: 'container', description: 'Kubernetes package manager' },
  k9s: { category: 'container', description: 'Kubernetes TUI' },

  // Network
  curl: { category: 'network', description: 'Transfer data with URLs' },
  wget: { category: 'network', description: 'Download files from the web' },
  ssh: { category: 'network', description: 'Secure shell connection' },
  scp: { category: 'network', description: 'Secure copy over SSH' },
  rsync: { category: 'network', description: 'Fast incremental file transfer' },
  ping: { category: 'network', description: 'Test network connectivity' },
  traceroute: { category: 'network', description: 'Trace packet route' },
  netstat: { category: 'network', description: 'Network statistics' },
  nc: { category: 'network', description: 'Netcat network utility' },
  telnet: { category: 'network', description: 'Telnet client' },
  ftp: { category: 'network', description: 'File transfer protocol client' },
  sftp: { category: 'network', description: 'Secure file transfer' },

  // Editors
  vim: { category: 'editor', description: 'Vi Improved text editor' },
  nvim: { category: 'editor', description: 'Neovim text editor' },
  nano: { category: 'editor', description: 'Simple text editor' },
  code: { category: 'editor', description: 'Visual Studio Code' },
  emacs: { category: 'editor', description: 'Extensible text editor' },
  vi: { category: 'editor', description: 'Visual text editor' },
};

/**
 * Frozen set of recommended commands for O(1) lookup.
 */
export const RECOMMENDED_COMMANDS: readonly string[] = Object.freeze(Object.keys(COMMAND_META));

/**
 * Check if a command is in the recommended list.
 */
export function isRecommendedCommand(command: string): boolean {
  return command in COMMAND_META;
}

/**
 * Get the category for a command.
 */
export function getCommandCategory(command: string): CommandCategory {
  return COMMAND_META[command]?.category ?? 'other';
}

/**
 * Get the description for a command.
 */
export function getCommandDescription(command: string): string | undefined {
  return COMMAND_META[command]?.description;
}
