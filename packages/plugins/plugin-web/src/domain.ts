/** domain 策略结构。 */
export interface DomainPolicy {
  allowDomains: string[];
  denyDomains: string[];
}

/** 校验 URL host 是否命中 domain 白/黑名单。 */
export function isDomainAllowed(policy: DomainPolicy, url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return false;
  }
  const matches = (domain: string): boolean => host === domain || host.endsWith(`.${domain}`);
  if (policy.denyDomains.some(matches)) return false;
  if (policy.allowDomains.length > 0 && !policy.allowDomains.some(matches)) return false;
  return true;
}
