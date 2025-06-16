
        let currentData = null;
        let currentChart = null;

        document.getElementById('csv-file').addEventListener('change', handleFileUpload);

        function handleFileUpload(event) {
            const file = event.target.files[0];
            if (!file) return;

            document.getElementById('file-info').textContent = `Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;

            Papa.parse(file, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                complete: function(results) {
                    if (results.errors.length > 0) {
                        showError('Error parsing CSV: ' + results.errors[0].message);
                        return;
                    }
                    
                    currentData = results.data;
                    displayDataPreview(currentData);
                    populateColumnSelects(Object.keys(currentData[0]));
                    
                    document.getElementById('data-section').style.display = 'block';
                    document.getElementById('analysis-section').style.display = 'block';
                    hideError();
                },
                error: function(error) {
                    showError('Error reading file: ' + error.message);
                }
            });
        }

        function displayDataPreview(data) {
            const info = document.getElementById('data-info');
            const preview = document.getElementById('data-preview');
            
            info.innerHTML = `
                <strong>Dataset Info:</strong> ${data.length} rows, ${Object.keys(data[0]).length} columns
            `;

            const headers = Object.keys(data[0]);
            const previewData = data.slice(0, 10);

            let table = '<table><thead><tr>';
            headers.forEach(header => {
                table += `<th>${header}</th>`;
            });
            table += '</tr></thead><tbody>';

            previewData.forEach(row => {
                table += '<tr>';
                headers.forEach(header => {
                    const value = row[header];
                    table += `<td>${value !== null && value !== undefined ? value : 'N/A'}</td>`;
                });
                table += '</tr>';
            });

            table += '</tbody></table>';
            
            if (data.length > 10) {
                table += `<p style="margin-top: 10px; font-style: italic; color: #666;">Showing first 10 of ${data.length} rows</p>`;
            }
            
            preview.innerHTML = table + '<button class="show-more-btn" onclick="toggleRows(this)">Show More</button>';
        }

        function populateColumnSelects(columns) {
            const selects = ['target-column', 'group-column', 'metric-column', 'feature-column', 'class-column'];
            
            selects.forEach(selectId => {
                const select = document.getElementById(selectId);
                select.innerHTML = '<option value="">Select column...</option>';
                
                columns.forEach(column => {
                    select.innerHTML += `<option value="${column}">${column}</option>`;
                });
            });
        }

        function switchTab(tabName) {
            document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            
            event.target.classList.add('active');
            document.getElementById(tabName).classList.add('active');
        }

        function performBayesianEstimation() {
            const targetColumn = document.getElementById('target-column').value;
            const priorMean = parseFloat(document.getElementById('prior-mean').value);
            
            if (!targetColumn) {
            alert('Please select a numeric column for Bayesian Estimation.');
            console.warn('No target column selected for Bayesian Estimation');
                showError('Please select a target column');
                return;
            }

            const values = currentData.map(row => row[targetColumn]).filter(val => !isNaN(val));
            
            if (values.length === 0) {
            alert('The selected column contains no numeric data. Please choose a numeric column.');
            console.warn('Target column contains no numeric values');
                showError('No valid numeric values found in target column');
                return;
            }

            // Bayesian estimation (conjugate prior for normal distribution)
            const n = values.length;
            const sampleMean = values.reduce((a, b) => a + b, 0) / n;
            const sampleVar = values.reduce((sum, val) => sum + Math.pow(val - sampleMean, 2), 0) / (n - 1);
            
            // Assuming normal-normal conjugate prior
            const priorPrecision = 1; // Prior precision (1/variance)
            const posteriorPrecision = priorPrecision + n;
            const posteriorMean = (priorPrecision * priorMean + n * sampleMean) / posteriorPrecision;
            const posteriorVar = 1 / posteriorPrecision;
            const credibleInterval = [
                posteriorMean - 1.96 * Math.sqrt(posteriorVar),
                posteriorMean + 1.96 * Math.sqrt(posteriorVar)
            ];

            const results = {
                'Sample Size': n,
                'Sample Mean': sampleMean.toFixed(4),
                'Sample Variance': sampleVar.toFixed(4),
                'Prior Mean': priorMean.toFixed(4),
                'Posterior Mean': posteriorMean.toFixed(4),
                'Posterior Variance': posteriorVar.toFixed(4),
                '95% Credible Interval': `[${credibleInterval[0].toFixed(4)}, ${credibleInterval[1].toFixed(4)}]`
            };

            displayResults('Bayesian Parameter Estimation', results);
            createHistogram(values, posteriorMean, targetColumn);
        }

        function performABTesting() {
            const groupColumn = document.getElementById('group-column').value;
            const metricColumn = document.getElementById('metric-column').value;
            
            if (!groupColumn || !metricColumn) {
            alert('Please select both a categorical group column and a numeric metric column for A/B testing.');
            console.warn('Missing column selections for A/B testing');
                showError('Please select both group and metric columns');
                return;
            }

            // Get unique groups
            const groups = [...new Set(currentData.map(row => row[groupColumn]))].filter(g => g !== null && g !== undefined);
            
            if (groups.length !== 2) {
            alert('A/B testing requires exactly 2 unique group values. Please select an appropriate column.');
            console.warn('Invalid number of groups for A/B testing');
                showError('A/B testing requires exactly 2 groups. Found: ' + groups.length);
                return;
            }

            const groupA = currentData.filter(row => row[groupColumn] === groups[0]);
            const groupB = currentData.filter(row => row[groupColumn] === groups[1]);
            
            const valuesA = groupA.map(row => row[metricColumn]).filter(val => !isNaN(val));
            const valuesB = groupB.map(row => row[metricColumn]).filter(val => !isNaN(val));

            if (valuesA.length === 0 || valuesB.length === 0) {
            alert('No numeric metric data found in one or both groups. Ensure your metric column contains numbers.');
            console.warn('No valid numeric metric data for A/B testing');
                showError('No valid numeric values found in one or both groups');
                return;
            }

            const meanA = valuesA.reduce((a, b) => a + b, 0) / valuesA.length;
            const meanB = valuesB.reduce((a, b) => a + b, 0) / valuesB.length;
            const varA = valuesA.reduce((sum, val) => sum + Math.pow(val - meanA, 2), 0) / (valuesA.length - 1);
            const varB = valuesB.reduce((sum, val) => sum + Math.pow(val - meanB, 2), 0) / (valuesB.length - 1);

            // Bayesian estimation of difference
            const pooledVar = ((valuesA.length - 1) * varA + (valuesB.length - 1) * varB) / (valuesA.length + valuesB.length - 2);
            const standardError = Math.sqrt(pooledVar * (1/valuesA.length + 1/valuesB.length));
            const difference = meanB - meanA;
            const probabilityBBetter = difference > 0 ? 0.5 + 0.5 * Math.abs(difference) / standardError / 2 : 0.5 - 0.5 * Math.abs(difference) / standardError / 2;

            const results = {
                [`Group ${groups[0]} Mean`]: meanA.toFixed(4),
                [`Group ${groups[1]} Mean`]: meanB.toFixed(4),
                'Difference (B - A)': difference.toFixed(4),
                'Standard Error': standardError.toFixed(4),
                'Probability B > A': Math.min(Math.max(probabilityBBetter, 0), 1).toFixed(4),
                [`Group ${groups[0]} Size`]: valuesA.length,
                [`Group ${groups[1]} Size`]: valuesB.length
            };

            displayResults('Bayesian A/B Testing', results);
            createComparisonChart([
                { label: groups[0], values: valuesA },
                { label: groups[1], values: valuesB }
            ]);
        }

        function performNaiveBayes() {
            const featureColumn = document.getElementById('feature-column').value;
            const classColumn = document.getElementById('class-column').value;
            
            if (!featureColumn || !classColumn) {
                showError('Please select both feature and class columns');
                return;
            }

            // Calculate class probabilities
            const classes = [...new Set(currentData.map(row => row[classColumn]))].filter(c => c !== null && c !== undefined);
            const totalSamples = currentData.length;
            
            const classProbabilities = {};
            const featureProbabilities = {};
            
            classes.forEach(cls => {
                const classData = currentData.filter(row => row[classColumn] === cls);
                classProbabilities[cls] = classData.length / totalSamples;
                
                // Calculate feature probabilities for this class
                const features = [...new Set(classData.map(row => row[featureColumn]))].filter(f => f !== null && f !== undefined);
                featureProbabilities[cls] = {};
                
                features.forEach(feature => {
                    const featureCount = classData.filter(row => row[featureColumn] === feature).length;
                    featureProbabilities[cls][feature] = featureCount / classData.length;
                });
            });

            // Create results summary
            const results = {
                'Total Samples': totalSamples,
                'Number of Classes': classes.length,
                'Classes': classes.join(', ')
            };

            // Add class probabilities
            classes.forEach(cls => {
                results[`P(${cls})`] = classProbabilities[cls].toFixed(4);
            });

            displayResults('Naive Bayes Classification', results);
            createClassificationChart(classProbabilities);
        }

        function displayResults(title, results) {
            document.getElementById('results-title').textContent = title;
            
            let content = '<div class="stat-grid">';
            for (const [key, value] of Object.entries(results)) {
                content += `
                    <div class="stat-card">
                        <span class="stat-value">${value}</span>
                        <div class="stat-label">${key}</div>
                    </div>
                `;
            }
            content += '</div>';
            
            document.getElementById('results-content').innerHTML = content;
            document.getElementById('results').style.display = 'block';
            
            // Scroll to results
            document.getElementById('results').scrollIntoView({ behavior: 'smooth' });
        }

        function createHistogram(data, mean, label) {
            const ctx = document.getElementById('results-chart').getContext('2d');
            
            if (currentChart) {
                currentChart.destroy();
            }

            // Create histogram bins
            const min = Math.min(...data);
            const max = Math.max(...data);
            const binCount = Math.min(20, Math.ceil(Math.sqrt(data.length)));
            const binWidth = (max - min) / binCount;
            const bins = Array(binCount).fill(0);
            const binLabels = [];

            for (let i = 0; i < binCount; i++) {
                binLabels.push((min + i * binWidth).toFixed(2));
                data.forEach(value => {
                    if (value >= min + i * binWidth && value < min + (i + 1) * binWidth) {
                        bins[i]++;
                    }
                });
            }

            currentChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: binLabels,
                    datasets: [{
                        label: `Distribution of ${label}`,
                        data: bins,
                        backgroundColor: 'rgba(102, 126, 234, 0.6)',
                        borderColor: 'rgba(102, 126, 234, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: `Data Distribution (Posterior Mean: ${mean.toFixed(4)})`
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Frequency'
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: label
                            }
                        }
                    }
                }
            });
        }

        function createComparisonChart(groups) {
            const ctx = document.getElementById('results-chart').getContext('2d');
            
            if (currentChart) {
                currentChart.destroy();
            }

            const colors = ['rgba(102, 126, 234, 0.6)', 'rgba(118, 75, 162, 0.6)'];
            const borderColors = ['rgba(102, 126, 234, 1)', 'rgba(118, 75, 162, 1)'];

            currentChart = new Chart(ctx, {
                type: 'box',
                data: {
                    labels: groups.map(g => g.label),
                    datasets: groups.map((group, index) => ({
                        label: group.label,
                        data: [{
                            min: Math.min(...group.values),
                            q1: percentile(group.values, 25),
                            median: percentile(group.values, 50),
                            q3: percentile(group.values, 75),
                            max: Math.max(...group.values),
                            mean: group.values.reduce((a, b) => a + b, 0) / group.values.length
                        }],
                        backgroundColor: colors[index],
                        borderColor: borderColors[index],
                        borderWidth: 2
                    }))
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Group Comparison'
                        }
                    }
                }
            });
        }

        function createClassificationChart(classProbabilities) {
            const ctx = document.getElementById('results-chart').getContext('2d');
            
            if (currentChart) {
                currentChart.destroy();
            }

            const labels = Object.keys(classProbabilities);
            const data = Object.values(classProbabilities);

            currentChart = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: [
                            'rgba(102, 126, 234, 0.8)',
                            'rgba(118, 75, 162, 0.8)',
                            'rgba(255, 99, 132, 0.8)',
                            'rgba(54, 162, 235, 0.8)',
                            'rgba(255, 206, 86, 0.8)'
                        ],
                        borderWidth: 2,
                        borderColor: '#fff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Class Probability Distribution'
                        },
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        }

        function percentile(arr, p) {
            const sorted = [...arr].sort((a, b) => a - b);
            const index = (p / 100) * (sorted.length - 1);
            const lower = Math.floor(index);
            const upper = Math.ceil(index);
            const weight = index % 1;
            
            if (upper >= sorted.length) return sorted[sorted.length - 1];
            return sorted[lower] * (1 - weight) + sorted[upper] * weight;
        }

        function showError(message) {
            const errorDiv = document.getElementById('error');
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        }

        function hideError() {
            document.getElementById('error').style.display = 'none';
        }
    


function toggleRows(button) {
    const rows = document.querySelectorAll("#data-preview tbody tr:nth-child(n+11)");
    const hidden = [...rows].some(row => row.style.display === "none" || !row.style.display);
    rows.forEach(row => row.style.display = hidden ? "table-row" : "none");
    button.textContent = hidden ? "Show Less" : "Show More";
}
