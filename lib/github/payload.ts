type JsonObject = Record<string, unknown>;

export function getAction(payload: JsonObject) {
  return typeof payload.action === "string" ? payload.action : null;
}

export function getInstallationId(payload: JsonObject) {
  const installation = payload.installation;

  if (
    installation &&
    typeof installation === "object" &&
    "id" in installation &&
    typeof installation.id === "number"
  ) {
    return installation.id;
  }

  return null;
}

export function getRepositoryFullName(payload: JsonObject) {
  const repository = payload.repository;

  if (
    repository &&
    typeof repository === "object" &&
    "full_name" in repository &&
    typeof repository.full_name === "string"
  ) {
    return repository.full_name;
  }

  return null;
}

export function getRepositoryId(payload: JsonObject) {
  const repository = payload.repository;

  if (
    repository &&
    typeof repository === "object" &&
    "id" in repository &&
    typeof repository.id === "number"
  ) {
    return repository.id;
  }

  return null;
}

export function getSenderLogin(payload: JsonObject) {
  const sender = payload.sender;

  if (
    sender &&
    typeof sender === "object" &&
    "login" in sender &&
    typeof sender.login === "string"
  ) {
    return sender.login;
  }

  return null;
}
