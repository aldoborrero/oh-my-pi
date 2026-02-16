{
  lib,
  stdenv,
  pkgs,
  fenix,
  crane,
  pkg-config,
  libx11,
  system,
}:
let
  # Platform tag mapping for the output .node file
  platformTag =
    {
      "x86_64-linux" = "linux-x64";
      "aarch64-linux" = "linux-arm64";
      "x86_64-darwin" = "darwin-x64";
      "aarch64-darwin" = "darwin-arm64";
    }
    .${system};

  # Use fenix nightly toolchain (required for edition 2024)
  toolchain = fenix.complete.withComponents [
    "cargo"
    "rustc"
    "rust-src"
  ];

  craneLib = (crane.mkLib pkgs).overrideToolchain toolchain;

  # Source - use the full repo and let crane handle filtering
  rootSrc = ../../..;

  # Use crane's source filtering for Rust files
  src = craneLib.cleanCargoSource rootSrc;

  # Common arguments for crane builds
  commonArgs = {
    inherit src;
    strictDeps = true;
    pname = "pi-natives";
    version = "12.6.0";

    # Build dependencies
    nativeBuildInputs = [ pkg-config ];

    # Runtime dependencies for arboard (clipboard support)
    buildInputs = lib.optionals stdenv.hostPlatform.isLinux [ libx11 ];

    # Only build the pi-natives crate
    cargoExtraArgs = "-p pi-natives";
  };

  # Build dependencies first (for caching)
  cargoArtifacts = craneLib.buildDepsOnly commonArgs;
in
craneLib.buildPackage (
  commonArgs
  // {
    inherit cargoArtifacts;

    # Custom install phase to copy the cdylib as .node file
    installPhaseCommand = ''
      mkdir -p $out/lib
      cp target/release/libpi_natives.so $out/lib/pi_natives.${platformTag}.node || \
      cp target/release/libpi_natives.dylib $out/lib/pi_natives.${platformTag}.node || \
      echo "Warning: Could not find native library"
    '';
  }
)
