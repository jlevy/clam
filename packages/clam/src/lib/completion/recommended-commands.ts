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
 * Mapping of commands to their categories.
 */
const COMMAND_CATEGORIES: Record<string, CommandCategory> = {
  // Shell basics
  ls: 'shell',
  cd: 'shell',
  cat: 'shell',
  grep: 'shell',
  find: 'shell',
  mkdir: 'shell',
  rm: 'shell',
  cp: 'shell',
  mv: 'shell',
  chmod: 'shell',
  chown: 'shell',
  pwd: 'shell',
  echo: 'shell',
  head: 'shell',
  tail: 'shell',
  less: 'shell',
  more: 'shell',
  wc: 'shell',
  sort: 'shell',
  uniq: 'shell',
  diff: 'shell',
  which: 'shell',
  whereis: 'shell',
  man: 'shell',
  history: 'shell',
  clear: 'shell',
  touch: 'shell',
  ln: 'shell',
  tar: 'shell',
  gzip: 'shell',
  gunzip: 'shell',
  zip: 'shell',
  unzip: 'shell',
  xargs: 'shell',
  sed: 'shell',
  awk: 'shell',
  ps: 'shell',
  kill: 'shell',
  top: 'shell',
  htop: 'shell',
  df: 'shell',
  du: 'shell',
  free: 'shell',
  env: 'shell',
  export: 'shell',
  source: 'shell',

  // Version control
  git: 'version-control',
  gh: 'version-control',
  svn: 'version-control',
  hg: 'version-control',

  // Package managers
  npm: 'package-manager',
  npx: 'package-manager',
  pnpm: 'package-manager',
  yarn: 'package-manager',
  bun: 'package-manager',
  pip: 'package-manager',
  pip3: 'package-manager',
  pipx: 'package-manager',
  uv: 'package-manager',
  cargo: 'package-manager',
  brew: 'package-manager',
  apt: 'package-manager',
  dnf: 'package-manager',
  yum: 'package-manager',
  pacman: 'package-manager',

  // Runtimes
  node: 'runtime',
  deno: 'runtime',
  python: 'runtime',
  python3: 'runtime',
  ruby: 'runtime',
  go: 'runtime',
  rustc: 'runtime',
  java: 'runtime',
  javac: 'runtime',

  // Containers
  docker: 'container',
  'docker-compose': 'container',
  podman: 'container',
  kubectl: 'container',
  helm: 'container',
  k9s: 'container',

  // Network
  curl: 'network',
  wget: 'network',
  ssh: 'network',
  scp: 'network',
  rsync: 'network',
  ping: 'network',
  traceroute: 'network',
  netstat: 'network',
  nc: 'network',
  telnet: 'network',
  ftp: 'network',
  sftp: 'network',

  // Editors
  vim: 'editor',
  nvim: 'editor',
  nano: 'editor',
  code: 'editor',
  emacs: 'editor',
  vi: 'editor',
};

/**
 * Frozen set of recommended commands for O(1) lookup.
 */
export const RECOMMENDED_COMMANDS: readonly string[] = Object.freeze(
  Object.keys(COMMAND_CATEGORIES)
);

/**
 * Check if a command is in the recommended list.
 */
export function isRecommendedCommand(command: string): boolean {
  return command in COMMAND_CATEGORIES;
}

/**
 * Get the category for a command.
 */
export function getCommandCategory(command: string): CommandCategory {
  return COMMAND_CATEGORIES[command] ?? 'other';
}
