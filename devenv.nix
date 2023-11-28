{ pkgs, ... }:

{
  enterShell = ''
    export PRISMA_SCHEMA_ENGINE_BINARY="${pkgs.prisma-engines}/bin/schema-engine"
    export PRISMA_QUERY_ENGINE_BINARY="${pkgs.prisma-engines}/bin/query-engine"
    export PRISMA_QUERY_ENGINE_LIBRARY="${pkgs.prisma-engines}/lib/libquery_engine.node"
    export PRISMA_INTROSPECTION_ENGINE_BINARY="${pkgs.prisma-engines}/bin/introspection-engine"
    export PRISMA_FMT_BINARY="${pkgs.prisma-engines}/bin/prisma-fmt"
  '';

  packages = with pkgs; [
    prisma-engines
    openssl
  ];

  languages = {
    typescript.enable = true;
    javascript.enable = true;
  };


  processes = {
    server.exec = "npm run dev";
    # tailwind.exec = "${pkgs.bun}/bin/bun run tailwind:css";
  };

  services = {
    postgres = {
      enable = true;
      package = pkgs.postgresql_15;
      initialScript = ''
        CREATE USER skymoth WITH SUPERUSER PASSWORD 'skymoth';
        CREATE DATABASE skymoth;
        ALTER USER skymoth CREATEDB;
        GRANT ALL PRIVILEGES ON DATABASE skymoth TO skymoth;
      '';
      listen_addresses = "127.0.0.1";
    };
  };
}
