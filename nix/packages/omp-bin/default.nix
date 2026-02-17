# oh-my-pi binary release package
{
  pkgs,
  system,
  ...
}:
let
  inherit (pkgs) lib;

  version = "12.9.0";

  # Platform-specific binary info
  platformInfo = {
    "x86_64-linux" = {
      name = "omp-linux-x64";
      hash = "0lyklgl43q4cvnmn1k7qy3l6y363p4zklpgx0zwfizr5b1r4wnl7";
    };
    "aarch64-linux" = {
      name = "omp-linux-arm64";
      hash = "1g6sjxy6nsrwfv7njsy6kiihmcrs0knnd8vdfcn82y1hnn34n3sp";
    };
    "x86_64-darwin" = {
      name = "omp-darwin-x64";
      hash = "1brvsjxkc4dwy1l1h9i35vnhywwidhjx9fc1idlmvwlgl6vi1rq0";
    };
    "aarch64-darwin" = {
      name = "omp-darwin-arm64";
      hash = "136z7969cl8wlfj2migzbl950j16lk963js8n3nsv1cgwqsbsnmw";
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
