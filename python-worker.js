// python-worker.js
importScripts("https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js");

let pyodideReadyPromise = loadPyodide();

self.onmessage = async (event) => {
    const { userCode, functionName, referenceSolution, testInputs } = event.data;
    const pyodide = await pyodideReadyPromise;

    const testRunnerScript = `
import json

# 1. Load the user's code
try:
    exec('''${userCode.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}''', globals())
except Exception as e:
    print(json.dumps({"passed": False, "error": f"Syntax Error in User Code: {str(e)}"}))

# 2. Load the hidden reference solution
try:
    exec('''${referenceSolution.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}''', globals())
except Exception as e:
    print(json.dumps({"passed": False, "error": f"Internal Error (Reference Solution): {str(e)}"}))

def run_tests():
    test_inputs = ${JSON.stringify(testInputs)}
    results = []
    all_passed = True
    
    user_func = globals().get('${functionName}')
    if not user_func:
        return json.dumps({
            "passed": False, 
            "error": f"Function '${functionName}' not found. Check your signature."
        })
        
    ref_func = globals().get('reference_solution')
    if not ref_func:
        return json.dumps({
            "passed": False, 
            "error": "Internal Error: Reference solution missing."
        })

    for i, args in enumerate(test_inputs):
        try:
            # Generate the expected output using the reference solution
            expected = ref_func(*args)
            
            # Get the user's output
            output = user_func(*args)
            
            if output == expected:
                results.append({"test": i + 1, "passed": True}) # FIXED: True (Python style)
            else:
                all_passed = False
                results.append({
                    "test": i + 1, 
                    "passed": False, # FIXED: False (Python style)
                    "error": f"Input: {args} | Expected: {expected}, Got: {output}"
                })
        except Exception as e:
            all_passed = False
            results.append({"test": i + 1, "passed": False, "error": f"Input: {args} | Runtime Error: {str(e)}"})
            
    return json.dumps({"passed": all_passed, "results": results})

run_tests()
`;

    try {
        const rawResult = await pyodide.runPythonAsync(testRunnerScript);
        self.postMessage({ success: true, data: JSON.parse(rawResult) });
    } catch (err) {
        self.postMessage({ success: false, error: err.message });
    }
};