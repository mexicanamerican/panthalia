export interface imagePrompt {
  imageId: number;
  postId: number;
  text: string,
  regen?: boolean;
}

type PanthaliaImageConstructorOptions = {
  promptText?: string;
  url?: URL;
};

/* Usage:
 *
const promptText = "A banana robbing a bank at gunpoint, pixel art"
const myImage = new PanthaliaImage(promptText);
myImage.generateKeyFromPrompt("User's Text Input With Some !Special? Characters.");

console.log(myImage.getPublicUrl());      // Fetch the public URL.
console.log(myImage.getBucketObjectKey()); // Fetch the bucket object key.
console.log(myImage.getLocalFilePath());  // Fetch the local file path.
console.log(myImage.getVariableName());   // Fetch the variable name for imports.
*/
export class PanthaliaImage {
  private promptText: string;
  private key: string;
  private baseUrl: string = `https://s3.amazonaws.com/${process.env.S3_BUCKET_NAME}`;
  private localPathRoot: string = '/src/images/';
  private error: Error = null;

  constructor(options: PanthaliaImageConstructorOptions) {
    if (!options.promptText && !options.url) {
      console.warn("PanthaliaImage warning: Neither promptText nor URL provided. Object might not behave as expected.");
      return;
    }

    if (options.promptText) {
      if (options.promptText.trim() === '') {
        console.warn("PanthaliaImage warning: Empty promptText. Object might not behave as expected.");
        return;
      }
    }
    if (options.promptText) {
      this.generateKeyFromPrompt(options.promptText);
      this.setPromptText(options.promptText);
    } else if (options.url) {
      this.generateKeyFromUrl(options.url);
    } else {
      throw new Error("New PanthaliImage error: invalid input provided.");
    }
  }

  isValid(): Boolean {
    if (this.hasError() === false && this.promptText && this.key) {
      return true;
    }
    return false;
  }

  setPromptText(promptText: string) {
    this.promptText = promptText
  }

  getPromptText(): string {
    return this.promptText
  }

  setError(error: Error) {
    this.error = error
  }

  getError(): Error {
    return this.error
  }

  hasError(): Boolean {
    return this.error !== null
  }

  toCamelCase(str: string): string {
    return str.replace(/-([a-zA-Z0-9])/g, function(g) { return g[1].toUpperCase(); })
      .replace(/-$/, ''); // handle edge case where the hyphen is at the end
  }

  generateKeyFromUrl(url: URL) {
    this.key = new URL(url).pathname.substring(1);
  }

  // Set or update the key based on the user-provided text.
  generateKeyFromPrompt(promptText: string) {
    // Convert the text into a suitable format for the S3 key.
    let sanitizedText = promptText
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove special characters.
      .replace(/\s+/g, '-')   // Replace spaces with hyphens.
      .substring(0, 35);      // Limit the length if necessary.

    this.key = sanitizedText;
  }

  getImageAltText(): string {
    return this.key.replaceAll('-', ' ',);
  }

  // Fetch the public URL of the image.
  getPublicUrl(): string {
    return `${this.baseUrl}/${this.key}`;
  }

  // Get the object key for the image within the bucket.
  getBucketObjectKey(): string {
    return this.key;
  }

  // Get the local file path.
  getLocalFilePath(): string {
    return `${this.localPathRoot}${this.key}.png`;
  }

  getImageVariableName(): string {
    return `${this.toCamelCase(this.key ?? 'Unknown')}Image`;
  }

  getImportStatement(): string {
    return `import ${this.getImageVariableName()} from '${this.getLocalFilePath()}'`;
  }

  getReactRenderedImage(): string {
    return `<Image src={${this.getImageVariableName()}}/>`
  }
}


