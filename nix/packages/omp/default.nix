{
  pkgs,
  inputs,
  system,
  ...
}:
let
  inherit (pkgs) lib;

  # Platform tag mapping
  platformTag =
    {
      "x86_64-linux" = "linux-x64";
      "aarch64-linux" = "linux-arm64";
      "x86_64-darwin" = "darwin-x64";
      "aarch64-darwin" = "darwin-arm64";
    }
    .${system};

  # Build the Rust native bindings
  piNatives = pkgs.callPackage ./rust.nix {
    inherit pkgs system;
    fenix = inputs.fenix.packages.${system};
    crane = inputs.crane;
  };

  # Fetch Bun dependencies (bun2nix is available via overlay)
  bunDeps = pkgs.bun2nix.fetchBunDeps {
    bunNix = ./bun.nix;
  };
in
pkgs.stdenv.mkDerivation {
  pname = "omp";
  version = "12.6.0";

  src = ../../..;

  # Pass bunDeps for reference
  inherit bunDeps;

  nativeBuildInputs = with pkgs; [
    bun
    makeWrapper
  ];

  # Don't try to strip Bun binary
  dontStrip = true;

  buildPhase = ''
        runHook preBuild

        # Set up writable directories for Bun
        export HOME="$PWD/.bun-home"
        mkdir -p "$HOME"

        # WORKAROUND: bun2nix has a known issue with workspace packages (#71)
        # bun install tries to fetch from network even with cached deps
        # Instead, we set up node_modules manually from the pre-built packages

        echo "Setting up node_modules from bunDeps..."

        # WORKAROUND: bun-packages has versioned directories (e.g., tailwindcss@4.1.18)
        # We need to create symlinks without version numbers for Bun to find them

        mkdir -p node_modules

        # Process scoped packages (@scope/package@version -> @scope/package)
        for scopedir in ${bunDeps}/share/bun-packages/@*; do
          scope=$(basename "$scopedir")
          mkdir -p "node_modules/$scope"
          for pkgdir in "$scopedir"/*; do
            pkgname=$(basename "$pkgdir" | sed 's/@[0-9].*//')
            if [ ! -e "node_modules/$scope/$pkgname" ]; then
              cp -rL "$pkgdir" "node_modules/$scope/$pkgname"
            fi
          done
        done

        # Process non-scoped packages (package@version -> package)
        for pkgdir in ${bunDeps}/share/bun-packages/*; do
          name=$(basename "$pkgdir")
          # Skip scoped packages (already handled above)
          if [[ "$name" != @* ]]; then
            pkgname=$(echo "$name" | sed 's/@[0-9].*//')
            if [ ! -e "node_modules/$pkgname" ]; then
              cp -rL "$pkgdir" "node_modules/$pkgname"
            fi
          fi
        done

        chmod -R u+w node_modules

        echo "node_modules setup complete. Sample:"
        ls node_modules/ | head -10
        ls node_modules/tailwindcss 2>/dev/null && echo "tailwindcss found!" || echo "tailwindcss NOT found"

        # WORKAROUND: entities version conflict
        # The lockfile has both entities@4.5.0 and entities@7.0.1. Our flat node_modules
        # setup copies the first match (4.5.0), but htmlparser2@10.1.0 requires entities@^7.0.1.
        # The issue manifests as: "Could not resolve: entities/decode"
        # - entities 4.x exports: ./lib/decode.js (different subpath)
        # - entities 7.x exports: ./decode (what htmlparser2 expects)
        # Proper fix would be nested node_modules, but for now we override to 7.x.
        if [ -d "${bunDeps}/share/bun-packages/entities@7.0.1" ]; then
          echo "Installing entities@7.0.1 (required by htmlparser2)..."
          rm -rf node_modules/entities
          cp -rL "${bunDeps}/share/bun-packages/entities@7.0.1" node_modules/entities
          chmod -R u+w node_modules/entities
        fi

        # Install the native library to the expected location
        mkdir -p packages/natives/native
        cp ${piNatives}/lib/pi_natives.${platformTag}.node packages/natives/native/

        # Generate embedded-addon.ts pointing to the native library
        cat > packages/natives/src/embedded-addon.ts << EOF
    import addonPath from "../native/pi_natives.${platformTag}.node" with { type: "file" };

    export interface EmbeddedAddon {
    	platform: string;
    	version: string;
    	filePath: string;
    }

    export const embeddedAddon: EmbeddedAddon | null = {
    	platform: "${platformTag}",
    	version: "12.6.0",
    	filePath: addonPath,
    };
    EOF

        # Build the stats client bundle
        bun --cwd=packages/stats run build

        # Generate client bundle embedding
        bun --cwd=packages/stats scripts/generate-client-bundle.ts

        # Compile the binary
        bun build \
          --compile \
          --minify \
          --sourcemap=none \
          --define PI_COMPILED=true \
          --root . \
          ./packages/coding-agent/src/cli.ts \
          --outfile omp

        runHook postBuild
  '';

  installPhase = ''
    runHook preInstall

    mkdir -p $out/bin
    cp omp $out/bin/omp

    wrapProgram $out/bin/omp \
      --set PI_SKIP_VERSION_CHECK 1

    runHook postInstall
  '';

  passthru.category = "AI Coding Agents";

  meta = {
    description = "A terminal-based coding agent with multi-model support";
    homepage = "https://github.com/can1357/oh-my-pi";
    license = lib.licenses.mit;
    sourceProvenance = with lib.sourceTypes; [ fromSource ];
    maintainers = with lib.maintainers; [ aldoborrero ];
    platforms = [
      "x86_64-linux"
      "aarch64-linux"
      "x86_64-darwin"
      "aarch64-darwin"
    ];
    mainProgram = "omp";
  };
}
