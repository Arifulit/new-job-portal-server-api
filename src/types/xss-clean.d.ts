declare module 'xss-clean' {
  const xss: (options?: {
    allowedTags?: string[];
    allowedAttributes?: { [key: string]: string[] };
    allowedSchemes?: { [key: string]: boolean };
    allowedIframeHostnames?: string[];
    allowVulnerableTags?: boolean;
  }) => (req: any, res: any, next: (err?: any) => void) => void;
  
  export = xss;
}
