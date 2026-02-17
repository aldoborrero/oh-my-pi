# oh-my-pi binary release package
{
  pkgs,
  system,
  ...
}:
let
  inherit (pkgs) lib;

  version = "12.8.2";

  # Platform-specific binary info
  platformInfo = {
    "x86_64-linux" = {
      name = "omp-linux-x64";
      hash = "1cfzbvlrlf06w5d3rw7qr9iyamxd8al5zmxqzply30x819dl78ya";
    };
    "aarch64-linux" = {
      name = "omp-linux-arm64";
      hash = "1j8zwbgm0s1ihai6p2nbai331jmi08jzfsby53lawhpkjcjf47a5";
    };
    "x86_64-darwin" = {
      name = "omp-darwin-x64";
      hash = "0sd1jq2pd1bicwc05c8v872ay3hnlcgv9dijnlh6d6lkdpwx9mp6";
    };
    "aarch64-darwin" = {
      name = "omp-darwin-arm64";
      hash = "1vpd03sxv6p0c26647qmjdxn12ikx81hx7j48vf061pl471sc9h1";
    };
  };

  info = platformInfo.${system} or (throw "Unsupported system: ${system}");

  src = pkgs.fetchurl {
    url = "https://github.com/can1357/oh-my-pi/releases/download/v${version}/${info.name}";
    sha256 = info.hash;
  };
in
pkgs.stdenvNoCC.mkDerivation {
  pname = "omp";
  inherit version src;

  dontUnpack = true;
  dontStrip = true;

  nativeBuildInputs =
    [ pkgs.makeWrapper ]
    ++ lib.optionals pkgs.stdenv.hostPlatform.isLinux [
      pkgs.autoPatchelfHook
    ];

  # Required by autoPatchelfHook on Linux
  buildInputs = lib.optionals pkgs.stdenv.hostPlatform.isLinux [
    pkgs.stdenv.cc.cc.lib
  ];

  installPhase = ''
    runHook preInstall

    mkdir -p $out/bin
    cp $src $out/bin/omp
    chmod +x $out/bin/omp

    wrapProgram $out/bin/omp \
      --set PI_SKIP_VERSION_CHECK 1

    runHook postInstall
  '';

  passthru.category = "AI Coding Agents";

  meta = {
    description = "A terminal-based coding agent with multi-model support (binary release)";
    homepage = "https://github.com/can1357/oh-my-pi";
    license = lib.licenses.mit;
    sourceProvenance = with lib.sourceTypes; [ binaryNativeCode ];
    maintainers = with lib.maintainers; [ aos ];
    platforms = builtins.attrNames platformInfo;
    mainProgram = "omp";
  };
}
