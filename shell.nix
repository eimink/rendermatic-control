{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    nodejs_24
    nodePackages.npm
    git
  ];

  shellHook = ''
    echo "🐚 Entering rendermatic-control development shell"
    npm --version
    node --version
  '';
}
