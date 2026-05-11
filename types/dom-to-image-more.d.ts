declare module 'dom-to-image-more' {
  interface Options {
    quality?: number;
    bgcolor?: string;
    width?: number;
    height?: number;
    style?: Partial<CSSStyleDeclaration>;
    [key: string]: unknown;
  }
  const domToImage: {
    toJpeg(node: HTMLElement, options?: Options): Promise<string>;
    toPng(node: HTMLElement, options?: Options): Promise<string>;
    toBlob(node: HTMLElement, options?: Options): Promise<Blob>;
    toSvg(node: HTMLElement, options?: Options): Promise<string>;
  };
  export default domToImage;
}
