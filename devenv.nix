{ pkgs, ... }:

{
  dotenv.enable = true;

  dotenv.filename = ".env.local";

  enterShell = ''
    export PRISMA_SCHEMA_ENGINE_BINARY="${pkgs.prisma-engines}/bin/schema-engine"
    export PRISMA_QUERY_ENGINE_BINARY="${pkgs.prisma-engines}/bin/query-engine"
    export PRISMA_QUERY_ENGINE_LIBRARY="${pkgs.prisma-engines}/lib/libquery_engine.node"
    export PRISMA_INTROSPECTION_ENGINE_BINARY="${pkgs.prisma-engines}/bin/introspection-engine"
    export PRISMA_FMT_BINARY="${pkgs.prisma-engines}/bin/prisma-fmt"
  '';

  packages = with pkgs; [
    prisma-engines
  ];

  languages = {
    typescript.enable = true;
    javascript.enable = true;
    javascript.pnpm = {
      enable = true;
      install.enable = true;
    };
  };

  processes = {
    server.exec = "pnpm run dev:server";
    scheduler.exec = "pnpm run dev:scheduler";
    tailwind.exec = "pnpm run tailwind:css";
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

  git-hooks.hooks.commitizen.enable = true;
  git-hooks.hooks.lint = {
    enable = true;
    name = "Lint code";
    entry = "pnpm run lint";
    pass_filenames = false;
  };
  git-hooks.hooks.format-check = {
    enable = true;
    name = "Check formatting";
    entry = "pnpm run format:check";
    pass_filenames = false;
  };
}
