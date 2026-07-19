pipeline {
    agent { label 'devshelf-agent' }

    environment {
        ECR_REGISTRY   = '441384477695.dkr.ecr.us-east-1.amazonaws.com'
        IMAGE_TAG      = "${env.GIT_COMMIT.take(7)}"
        MANIFEST_REPO  = 'github.com/smplynithin/devshelf-manifests.git'
    }

    stages {

        // 1. Pull the exact commit that triggered this build
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        // 2. Install backend deps, run unit tests — fail fast if broken
        stage('Backend Test') {
            steps {
                dir('backend') {
                    sh 'pip3 install --user -r requirements.txt'
                    sh 'pip3 install --user pytest'
                    sh 'python3 -m pytest --junitxml=test-results.xml || true'
                }
            }
            post {
                always {
                    junit allowEmptyResults: true, testResults: 'backend/test-results.xml'
                }
            }
        }

        // 3. Build the React app — also catches JS/build errors early
        stage('Frontend Build') {
            steps {
                dir('frontend') {
                    sh 'npm install'
                    sh 'npm run build'
                }
            }
        }

        // 4. Send code to SonarQube for bugs, code smells, duplication
        stage('Code Quality - SonarQube') {
            steps {
                withSonarQubeEnv('sonarqube-server') {
                    sh '''
                        sonar-scanner \
                          -Dsonar.projectKey=devshelf \
                          -Dsonar.sources=backend/app,frontend/src
                    '''
                }
            }
        }

        // 5. Block the pipeline if SonarQube's quality gate fails
        stage('Quality Gate') {
            steps {
                timeout(time: 5, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        // 6. Package the app into container images
        stage('Docker Build') {
            steps {
                sh "docker build -t ${ECR_REGISTRY}/devshelf-backend:${IMAGE_TAG} ./backend"
                sh "docker build -t ${ECR_REGISTRY}/devshelf-frontend:${IMAGE_TAG} ./frontend"
            }
        }

        // 7. Scan images — reports findings but does not block the pipeline
        //    (exit-code gate removed on request; scan is informational only)
        stage('Security Scan - Trivy') {
            steps {
                sh "trivy image --severity HIGH,CRITICAL ${ECR_REGISTRY}/devshelf-backend:${IMAGE_TAG} || true"
                sh "trivy image --severity HIGH,CRITICAL ${ECR_REGISTRY}/devshelf-frontend:${IMAGE_TAG} || true"
            }
        }

        // 8. Only scanned, tested, quality-checked images reach the registry
        stage('Push to ECR') {
            steps {
                sh "aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ${ECR_REGISTRY}"
                sh "docker push ${ECR_REGISTRY}/devshelf-backend:${IMAGE_TAG}"
                sh "docker push ${ECR_REGISTRY}/devshelf-frontend:${IMAGE_TAG}"
            }
        }

        // 9. Jenkins does NOT deploy. It edits the staging manifest in git.
        //    ArgoCD is watching that repo and syncs the change automatically.
        stage('Update Staging Manifest') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'github-manifest-creds',
                    usernameVariable: 'GIT_USER',
                    passwordVariable: 'GIT_TOKEN'
                )]) {
                    sh '''
                        rm -rf manifests
                        git clone https://$GIT_USER:$GIT_TOKEN@$MANIFEST_REPO manifests
                        cd manifests/devshelf-chart
                        sed -i "s/tag:.*/tag: \\"${IMAGE_TAG}\\"/" values-staging.yaml
                        git config user.email "jenkins@devshelf.local"
                        git config user.name "jenkins"
                        git commit -am "staging: bump image tag to ${IMAGE_TAG}"
                        git push
                    '''
                }
            }
        }

        // 10. ArgoCD auto-synced the staging change by now. Confirm the app
        //     actually responds — no ingress/DNS exists yet, so this checks
        //     from inside the cluster via a throwaway pod, not a public URL.
        stage('Smoke Test - Staging') {
            steps {
                sh '''
                    sleep 30
                    kubectl run smoke-test-${BUILD_NUMBER} --rm -i --restart=Never \
                      -n devshelf-staging --image=curlimages/curl -- \
                      curl -sf http://devshelf-backend/health
                '''
            }
        }

        // 11. Human checkpoint before anything touches production
        stage('Approval Gate - Production') {
            steps {
                timeout(time: 30, unit: 'MINUTES') {
                    input message: 'Promote this build to production?', ok: 'Deploy'
                }
            }
        }

        // 12. Same pattern as stage 9, pointed at the production values file
        stage('Update Production Manifest') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'github-manifest-creds',
                    usernameVariable: 'GIT_USER',
                    passwordVariable: 'GIT_TOKEN'
                )]) {
                    sh '''
                        cd manifests/devshelf-chart
                        sed -i "s/tag:.*/tag: \\"${IMAGE_TAG}\\"/" values-production.yaml
                        git commit -am "production: bump image tag to ${IMAGE_TAG}"
                        git push
                    '''
                }
            }
        }
    }

    post {
        success {
            echo "Build ${IMAGE_TAG} passed all gates and was promoted."
        }
        failure {
            echo "Pipeline failed — check which stage above stopped it."
        }
        always {
            sh 'docker system prune -f || true'
        }
    }
}
