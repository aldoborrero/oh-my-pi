{
  pkgs,
  inputs,
  system,
  ...
}:
let
  # Rust nightly toolchain via fenix (required for edition 2024)
  fenixPkgs = inputs.fenix.packages.${system};
  rustToolchain = fenixPkgs.complete.withComponents [
    "cargo"
    "rustc"
    "rust-src"
    "rust-analyzer"
    "clippy"
    "rustfmt"
  ];
in
pkgs.mkShellNoCC {
  packages =
    [
      # JavaScript/TypeScript
      pkgs.bun
      pkgs.bun2nix

      # Rust
      rustToolchain

      # Native build dependencies
      pkgs.pkg-config

      # Development utilities
      pkgs.git
    ]
    ++ pkgs.lib.optionals pkgs.stdenv.hostPlatform.isLinux [
      # Linux-specific: clipboard support for pi-natives
      pkgs.libx11
    ];

  shellHook = ''
    export PRJ_ROOT=$PWD
  '';
}
