export const HOST_ID = 'promptdock-extension-host';
const MOUNT_ID = 'promptdock-root';

export type ExtensionHost = {
  host: HTMLElement;
  shadowRoot: ShadowRoot;
  mount: HTMLDivElement;
};

export const ensureExtensionHost = (doc = document): ExtensionHost => {
  const existing = doc.getElementById(HOST_ID);
  if (existing instanceof HTMLElement && existing.shadowRoot) {
    const mount = existing.shadowRoot.getElementById(MOUNT_ID);
    if (mount instanceof HTMLDivElement) return { host: existing, shadowRoot: existing.shadowRoot, mount };
  }
  existing?.remove();

  const host = doc.createElement('div');
  host.id = HOST_ID;
  host.style.position = 'fixed';
  host.style.inset = '0';
  host.style.width = '0';
  host.style.height = '0';
  host.style.zIndex = '2147483000';
  host.style.pointerEvents = 'none';
  doc.body.appendChild(host);

  const shadowRoot = host.attachShadow({ mode: 'open' });
  const mount = doc.createElement('div');
  mount.id = MOUNT_ID;
  shadowRoot.appendChild(mount);
  return { host, shadowRoot, mount };
};

export const removeExtensionHost = (doc = document) => {
  doc.getElementById(HOST_ID)?.remove();
};

