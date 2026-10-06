if (process.platform !== "win32" || process.arch !== "x64")
  throw new Error("This packaging command is verified for Windows x64 only.");
await import("./package-desktop");

export {};
