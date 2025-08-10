{ pkgs, ... }:

{
  dotenv = {
    enable = true;
    filename = ".env.local";
  };

  packages = with pkgs; [
    zizmor
    pinact
  ];

  languages = {
    typescript.enable = true;

    javascript = {
      enable = true;
      pnpm = {
        enable = true;
        install.enable = true;
      };
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
      listen_addresses = "127.0.0.1";

      initialScript = ''
        CREATE USER skymoth WITH SUPERUSER PASSWORD 'skymoth';
        CREATE DATABASE skymoth;
        ALTER USER skymoth CREATEDB;
        GRANT ALL PRIVILEGES ON DATABASE skymoth TO skymoth;
      '';
    };
  };

  git-hooks.hooks = {
    commitizen.enable = true;

    lint = {
      enable = true;
      name = "Lint code";
      entry = "pnpm run lint";
      pass_filenames = false;
    };

    format-check = {
      enable = true;
      name = "Check formatting";
      entry = "pnpm run format:check";
      pass_filenames = false;
    };

    zizmor = {
      enable = true;
      name = "GitHub Actions security audit";
      entry = "${pkgs.zizmor}/bin/zizmor --persona auditor";
      files = "\\.github/workflows/.*\\.ya?ml$";
    };
  };
}
