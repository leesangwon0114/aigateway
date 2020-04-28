# need api-key.json in grpcgateway

# grpcgateway launch.json
{
    // Use IntelliSense to learn about possible attributes.
    // Hover to view descriptions of existing attributes.
    // For more information, visit: https://go.microsoft.com/fwlink/?linkid=830387
    "version": "0.2.0",
    "configurations": [
        {
            "type": "node",
            "request": "launch",
            "name": "Launch Program",
            "skipFiles": [
                "<node_internals>/**"
            ],
            "env": {"GOOGLE_APPLICATION_CREDENTIALS" : "${workspaceFolder}/api-key.json"}, 
            "program": "${workspaceFolder}/server.js"
        }
    ]
}

# node web launch.json
{
    // Use IntelliSense to learn about possible attributes.
    // Hover to view descriptions of existing attributes.
    // For more information, visit: https://go.microsoft.com/fwlink/?linkid=830387
    "version": "0.2.0",
    "configurations": [
        {
            "type": "node",
            "request": "launch",
            "name": "Launch Program",
            "skipFiles": [
                "<node_internals>/**"
            ],
            "env": {"GOOGLE_APPLICATION_CREDENTIALS" : "${workspaceFolder}/src/api-key.json"}, 
            "program": "${workspaceFolder}/src/app.js"
        }
    ]
}
