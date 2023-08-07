export interface imagePrompt {
  postId: number;
  text: string,
  // The type is a string that can either be "leader" or "image"                              
  type: "leader" | "image"
}


type S3ImageConstructorOptions = {
  promptText?: string;
  url?: URL;
};

/* Usage:
 *
const promptText = "A banana robbing a bank at gunpoint, pixel art"
const myImage = new S3Image(promptText);
myImage.generateKeyFromPrompt("User's Text Input With Some !Special? Characters.");

console.log(myImage.getPublicUrl());      // Fetch the public URL.
console.log(myImage.getBucketObjectKey()); // Fetch the bucket object key.
console.log(myImage.getLocalFilePath());  // Fetch the local file path.
console.log(myImage.getVariableName());   // Fetch the variable name for imports.
*/
export class S3Image {
  private key: string;
  private baseUrl: string = `https://s3.amazonaws.com/${process.env.S3_BUCKET_NAME}`;
  private localPathRoot: string = '/src/images/';

  constructor(options: S3ImageConstructorOptions) {
    if (options.promptText) {
      this.generateKeyFromPrompt(options.promptText);
    } else if (options.url) {
      this.generateKeyFromUrl(options.url);
    } else {
      throw new Error("Invalid input provided.");
    }
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
    return `${this.key}Image`;
  }

  getImportStatement(): string {
    return `import ${this.getImageVariableName()} from '${this.getLocalFilePath()}'`;
  }

  getReactRenderedImage(): string {
    const importStatement = this.getImportStatement();
    return `${importStatement}\n\n<Image src={${this.getImageVariableName()}}/>}`
  }
}


