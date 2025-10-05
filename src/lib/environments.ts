import type { Environment, EnvironmentVariable } from "@/types"

/**
 * Creates a map of variable names to their values for quick lookups.
 * @param environment The environment to extract variables from.
 * @returns A Record mapping variable names to their string values.
 */
function getVariableMap(environment: Environment | undefined): Record<string, string> {
  if (!environment) {
    return {}
  }
  return Object.values(environment.variables).reduce(
    (acc, variable: EnvironmentVariable) => {
      // Only include enabled variables; disabled ones are ignored during substitution
      if (variable.name && variable.enabled) {
        acc[variable.name] = variable.value
      }
      return acc
    },
    {} as Record<string, string>,
  )
}

/**
 * Substitutes environment variables in a string.
 * Looks for {{variableName}} patterns and replaces them with values from the provided environment.
 *
 * @param input The string to process.
 * @param variables A map of variable names to their values.
 * @returns The processed string with variables substituted.
 */
export function substituteVariables(input: string, variables: Record<string, string>): string {
  if (!input || Object.keys(variables).length === 0) {
    return input
  }

  // Regex to find all {{variableName}} occurrences
  return input.replace(/\{\{([^}]+)\}\}/g, (match, variableName) => {
    // If the variable exists in our map, replace it. Otherwise, keep the original placeholder.
    return variables[variableName] !== undefined ? variables[variableName] : match
  })
}

/**
 * Deeply substitutes variables in a request object.
 * Creates a new request object with all variables in the URL, params, and headers replaced.
 *
 * @param request The original request state.
 * @param environment The environment to apply.
 * @returns A new RequestState object with all variables substituted.
 */
export function resolveRequestVariables<T extends object>(request: T, environment: Environment | undefined): T {
  const variables = getVariableMap(environment)
  if (Object.keys(variables).length === 0) {
    return request
  }

  // Deep clone the request object to avoid mutating the original state
  const resolvedRequest = structuredClone(request)

  // Substitute in URL with environment variables first
  if ("url" in resolvedRequest && typeof resolvedRequest.url === "string") {
    resolvedRequest.url = substituteVariables(resolvedRequest.url, variables)
  }

  // Substitute in Path Params values using environment variables
  if ("pathParams" in resolvedRequest && resolvedRequest.pathParams) {
    for (const param of Object.values(resolvedRequest.pathParams as Record<string, { value: string; name?: string }>)) {
      param.value = substituteVariables(param.value, variables)
    }
  }

  // After resolving path param values, also inject path params into URL when placeholders are present
  if (
    "url" in resolvedRequest &&
    typeof resolvedRequest.url === "string" &&
    "pathParams" in resolvedRequest &&
    resolvedRequest.pathParams
  ) {
    let url = resolvedRequest.url as unknown as string
    const params = resolvedRequest.pathParams as Record<string, { value: string; name?: string }>
    for (const [key, param] of Object.entries(params)) {
      const name = param.name ?? key
      const resolvedValue = param.value
      // Only inject when the resolved value itself no longer contains variable placeholders
      if (/\{\{/.test(resolvedValue)) {
        continue
      }
      const pat = `{{${name}}}`
      const escaped = pat.replace(/[.*+?^${}()|[\\]/g, "\\$&")
      url = url.replace(new RegExp(escaped, "g"), resolvedValue)
    }
    ;(resolvedRequest as { url?: string }).url = url
  }

  // Substitute in Query Params
  if ("queryParams" in resolvedRequest && resolvedRequest.queryParams) {
    for (const param of Object.values(
      resolvedRequest.queryParams as Record<string, { value: string; name?: string }>,
    )) {
      param.value = substituteVariables(param.value, variables)
    }
  }

  // After resolving query param values, also replace any placeholders in the URL matching the param names
  if (
    "url" in resolvedRequest &&
    typeof resolvedRequest.url === "string" &&
    "queryParams" in resolvedRequest &&
    resolvedRequest.queryParams
  ) {
    let url = resolvedRequest.url as unknown as string
    const qps = resolvedRequest.queryParams as Record<string, { value: string; name?: string }>
    for (const [key, qp] of Object.entries(qps)) {
      const name = qp.name ?? key
      const resolvedValue = qp.value
      if (/\{\{/.test(resolvedValue)) {
        continue
      }
      const pat = `{{${name}}}`
      const escaped = pat.replace(/[.*+?^${}()|[\\]/g, "\\$&")
      url = url.replace(new RegExp(escaped, "g"), resolvedValue)
    }
    ;(resolvedRequest as { url?: string }).url = url
  }

  // Substitute in Headers
  if ("headers" in resolvedRequest && resolvedRequest.headers) {
    for (const header of Object.values(resolvedRequest.headers as Record<string, { value: string }>)) {
      header.value = substituteVariables(header.value, variables)
    }
  }

  return resolvedRequest
}
